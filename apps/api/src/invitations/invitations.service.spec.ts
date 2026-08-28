import { InvitationsService } from './invitations.service';
import type { MailService } from '../mail/mail.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('InvitationsService', () => {
  let prisma: {
    household: { findUniqueOrThrow: jest.Mock };
    householdInvitation: { create: jest.Mock; findMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let mailService: { sendInvitationEmail: jest.Mock };
  let service: InvitationsService;

  const invitationRow = {
    id: 'inv-1',
    householdId: 'h1',
    email: 'sam@example.com',
    tokenHash: 'super-secret-hash',
    invitedById: 'u1',
    expiresAt: new Date('2026-08-19T00:00:00.000Z'),
    acceptedAt: null,
    createdAt: new Date('2026-08-12T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      household: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'h1', name: 'Le Nid' }) },
      householdInvitation: {
        create: jest.fn().mockResolvedValue(invitationRow),
        findMany: jest.fn().mockResolvedValue([invitationRow]),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    mailService = { sendInvitationEmail: jest.fn().mockResolvedValue({ delivered: true }) };
    service = new InvitationsService(
      prisma as unknown as PrismaService,
      mailService as unknown as MailService,
    );
  });

  it('never returns tokenHash from create(), and returns the raw token instead', async () => {
    mailService.sendInvitationEmail.mockResolvedValue({ delivered: true });
    const result = await service.create('h1', 'u1', 'sam@example.com');

    expect(result).not.toHaveProperty('tokenHash');
    expect(typeof result.token).toBe('string');
    expect(result.token).not.toBe(invitationRow.tokenHash);
    expect(result.id).toBe('inv-1');
    expect(result.emailDelivered).toBe(true);
  });

  it('still creates and returns the invitation when the email fails to send', async () => {
    mailService.sendInvitationEmail.mockResolvedValue({ delivered: false });

    const result = await service.create('h1', 'u1', 'sam@example.com');

    expect(prisma.householdInvitation.create).toHaveBeenCalled();
    expect(result.id).toBe('inv-1');
    expect(typeof result.token).toBe('string');
    expect(result.emailDelivered).toBe(false);
  });

  it('never returns tokenHash from listForHousehold()', async () => {
    const result = await service.listForHousehold('h1');

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('tokenHash');
    expect(result[0]?.id).toBe('inv-1');
  });
});
