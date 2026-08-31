import { HouseholdRole, Prisma } from '@prisma/client';

import { INVITATION_CODE_ALPHABET, INVITATION_CODE_LENGTH } from './invitation-code.util';
import { InvitationsService } from './invitations.service';
import type { AppException } from '../common/exceptions/app-exception';
import type { MailService } from '../mail/mail.service';
import type { PrismaService } from '../prisma/prisma.service';

const FUTURE = new Date(Date.now() + 60 * 60 * 1000);
const PAST = new Date(Date.now() - 60 * 60 * 1000);

function baseInvitation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inv-1',
    householdId: 'h1',
    email: null,
    codeHash: 'hash-of-current-code',
    invitedById: 'u1',
    expiresAt: FUTURE,
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date('2026-08-12T00:00:00.000Z'),
    ...overrides,
  };
}

describe('InvitationsService', () => {
  let prisma: {
    household: { findUnique: jest.Mock };
    householdInvitation: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    householdMember: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let mailService: { sendInvitationEmail: jest.Mock };
  let configService: { getOrThrow: jest.Mock };
  let service: InvitationsService;

  beforeEach(() => {
    prisma = {
      household: { findUnique: jest.fn().mockResolvedValue({ id: 'h1', name: 'Le Nid' }) },
      householdInvitation: {
        create: jest.fn().mockResolvedValue(baseInvitation()),
        findMany: jest.fn().mockResolvedValue([baseInvitation()]),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      householdMember: { findUnique: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(),
    };
    mailService = { sendInvitationEmail: jest.fn().mockResolvedValue({ delivered: true }) };
    configService = { getOrThrow: jest.fn().mockReturnValue('test-jwt-access-secret') };
    service = new InvitationsService(
      prisma as unknown as PrismaService,
      mailService as unknown as MailService,
      configService as never,
    );
  });

  describe('create', () => {
    it('never returns codeHash, and returns the raw code instead', async () => {
      const result = await service.create('h1', 'u1');

      expect(result).not.toHaveProperty('codeHash');
      expect(typeof result.code).toBe('string');
      expect(result.code).not.toBe('hash-of-current-code');
      expect(result.id).toBe('inv-1');
    });

    it('generates a code matching the expected alphabet and length, hashed before storage', async () => {
      const result = await service.create('h1', 'u1');
      const storedData = prisma.householdInvitation.create.mock.calls[0][0].data;

      expect(result.code).toHaveLength(INVITATION_CODE_LENGTH);
      expect(result.code).toMatch(new RegExp(`^[${INVITATION_CODE_ALPHABET}]+$`));
      expect(storedData.codeHash).not.toBe(result.code);
    });

    it('does not require an email, and does not attempt to send one', async () => {
      const result = await service.create('h1', 'u1');

      expect(mailService.sendInvitationEmail).not.toHaveBeenCalled();
      expect(result.emailDelivered).toBeNull();
      expect(result.email).toBeNull();
    });

    it('sends a best-effort email when one is provided, without failing the creation on delivery failure', async () => {
      mailService.sendInvitationEmail.mockResolvedValue({ delivered: false });
      prisma.householdInvitation.create.mockResolvedValue(
        baseInvitation({ email: 'sam@example.com' }),
      );

      const result = await service.create('h1', 'u1', 'sam@example.com');

      expect(mailService.sendInvitationEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'sam@example.com', householdName: 'Le Nid' }),
      );
      expect(result.emailDelivered).toBe(false);
      expect(result.id).toBe('inv-1');
    });

    it('revokes any existing active invitation before creating a new one (single active code per household)', async () => {
      await service.create('h1', 'u1');

      expect(prisma.householdInvitation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ householdId: 'h1', acceptedAt: null, revokedAt: null }),
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });

    it('retries once on a code collision (unique constraint violation) rather than failing', async () => {
      const collision = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      Object.setPrototypeOf(collision, Prisma.PrismaClientKnownRequestError.prototype);
      prisma.householdInvitation.create
        .mockRejectedValueOnce(collision)
        .mockResolvedValueOnce(baseInvitation());

      const result = await service.create('h1', 'u1');

      expect(prisma.householdInvitation.create).toHaveBeenCalledTimes(2);
      expect(result.id).toBe('inv-1');
    });

    it('throws NOT_FOUND for a household that does not exist', async () => {
      prisma.household.findUnique.mockResolvedValue(null);

      await expect(service.create('missing', 'u1')).rejects.toMatchObject<Partial<AppException>>({
        code: 'NOT_FOUND',
      });
    });

    it('never logs or persists the raw code anywhere but the returned response', async () => {
      const result = await service.create('h1', 'u1');

      const auditMetadata = prisma.auditLog.create.mock.calls[0][0].data.metadata;
      expect(JSON.stringify(auditMetadata)).not.toContain(result.code);
    });
  });

  describe('accept', () => {
    it('rejects a code with an invalid format before ever querying the database', async () => {
      await expect(service.accept('not-a-valid-code!!', 'u1')).rejects.toMatchObject<
        Partial<AppException>
      >({ code: 'INVITATION_CODE_INVALID' });
      expect(prisma.householdInvitation.findUnique).not.toHaveBeenCalled();
    });

    it('normalizes separators, a display prefix and casing before checking the code', async () => {
      prisma.householdInvitation.findUnique.mockResolvedValue(null);

      await expect(service.accept('nid-7k4p-2q9d', 'u1')).rejects.toMatchObject<
        Partial<AppException>
      >({ code: 'INVITATION_NOT_FOUND' });
      // Le format normalisé (8 caractères, sans séparateurs) doit avoir passé la validation
      // de format pour atteindre la recherche en base.
      expect(prisma.householdInvitation.findUnique).toHaveBeenCalled();
    });

    it('rejects an unknown code', async () => {
      prisma.householdInvitation.findUnique.mockResolvedValue(null);

      await expect(service.accept('23456789', 'u1')).rejects.toMatchObject<Partial<AppException>>({
        code: 'INVITATION_NOT_FOUND',
      });
    });

    it('rejects a revoked invitation', async () => {
      prisma.householdInvitation.findUnique.mockResolvedValue(baseInvitation({ revokedAt: PAST }));

      await expect(service.accept('23456789', 'u1')).rejects.toMatchObject<Partial<AppException>>({
        code: 'INVITATION_REVOKED',
      });
    });

    it('rejects an expired invitation', async () => {
      prisma.householdInvitation.findUnique.mockResolvedValue(baseInvitation({ expiresAt: PAST }));

      await expect(service.accept('23456789', 'u1')).rejects.toMatchObject<Partial<AppException>>({
        code: 'INVITATION_EXPIRED',
      });
    });

    it('rejects an already-accepted invitation', async () => {
      prisma.householdInvitation.findUnique.mockResolvedValue(baseInvitation({ acceptedAt: PAST }));

      await expect(service.accept('23456789', 'u1')).rejects.toMatchObject<Partial<AppException>>({
        code: 'INVITATION_ALREADY_ACCEPTED',
      });
    });

    it('rejects (without consuming the code) a user who is already a member', async () => {
      prisma.householdInvitation.findUnique.mockResolvedValue(baseInvitation());
      prisma.householdMember.findUnique.mockResolvedValue({
        householdId: 'h1',
        userId: 'u1',
        role: HouseholdRole.MEMBER,
      });

      await expect(service.accept('23456789', 'u1')).rejects.toMatchObject<Partial<AppException>>({
        code: 'ALREADY_MEMBER',
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates the membership and marks the invitation accepted on success', async () => {
      prisma.householdInvitation.findUnique.mockResolvedValue(baseInvitation());
      prisma.householdMember.findUnique.mockResolvedValue(null);
      const invitationUpdate = jest.fn().mockResolvedValue({});
      const memberCreate = jest
        .fn()
        .mockResolvedValue({ householdId: 'h1', userId: 'u2', role: HouseholdRole.MEMBER });
      const householdFindUniqueOrThrow = jest.fn().mockResolvedValue({ id: 'h1', name: 'Le Nid' });
      prisma.$transaction.mockImplementation(
        async (
          fn: (tx: {
            householdInvitation: { update: typeof invitationUpdate };
            householdMember: { create: typeof memberCreate };
            household: { findUniqueOrThrow: typeof householdFindUniqueOrThrow };
          }) => unknown,
        ) =>
          fn({
            householdInvitation: { update: invitationUpdate },
            householdMember: { create: memberCreate },
            household: { findUniqueOrThrow: householdFindUniqueOrThrow },
          }),
      );

      const result = await service.accept('23456789', 'u2');

      expect(invitationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { acceptedAt: expect.any(Date) } }),
      );
      expect(memberCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { householdId: 'h1', userId: 'u2', role: 'MEMBER' } }),
      );
      expect(result).toEqual({ householdId: 'h1', householdName: 'Le Nid', role: 'MEMBER' });
    });
  });

  describe('revoke', () => {
    it('soft-revokes (sets revokedAt) rather than deleting the row', async () => {
      prisma.householdInvitation.findUnique.mockResolvedValue(baseInvitation());
      prisma.householdMember.findUnique.mockResolvedValue({ role: HouseholdRole.OWNER });
      prisma.householdInvitation.update.mockResolvedValue({});

      await service.revoke('inv-1', 'owner-1');

      expect(prisma.householdInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects a requester who is neither OWNER nor ADMIN', async () => {
      prisma.householdInvitation.findUnique.mockResolvedValue(baseInvitation());
      prisma.householdMember.findUnique.mockResolvedValue({ role: HouseholdRole.MEMBER });

      await expect(service.revoke('inv-1', 'member-1')).rejects.toMatchObject<
        Partial<AppException>
      >({ code: 'FORBIDDEN' });
    });

    it('rejects revoking an already-accepted invitation', async () => {
      prisma.householdInvitation.findUnique.mockResolvedValue(baseInvitation({ acceptedAt: PAST }));
      prisma.householdMember.findUnique.mockResolvedValue({ role: HouseholdRole.OWNER });

      await expect(service.revoke('inv-1', 'owner-1')).rejects.toMatchObject<Partial<AppException>>(
        { code: 'INVITATION_ALREADY_ACCEPTED' },
      );
    });

    it('is idempotent when the invitation is already revoked', async () => {
      prisma.householdInvitation.findUnique.mockResolvedValue(baseInvitation({ revokedAt: PAST }));
      prisma.householdMember.findUnique.mockResolvedValue({ role: HouseholdRole.OWNER });

      await expect(service.revoke('inv-1', 'owner-1')).resolves.toBeUndefined();
      expect(prisma.householdInvitation.update).not.toHaveBeenCalled();
    });
  });

  describe('listForHousehold', () => {
    it('never returns codeHash, and includes a derived status', async () => {
      const result = await service.listForHousehold('h1');

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('codeHash');
      expect(result[0]?.status).toBe('pending');
    });
  });
});
