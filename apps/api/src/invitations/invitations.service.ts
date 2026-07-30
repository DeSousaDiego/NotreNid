import { createHash, randomBytes } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import { HouseholdRole } from '@prisma/client';

import { AppException } from '../common/exceptions/app-exception';
import { normalizeEmail } from '../common/utils/normalize-email';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async create(householdId: string, invitedById: string, email: string) {
    const household = await this.prisma.household.findUniqueOrThrow({ where: { id: householdId } });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    const invitation = await this.prisma.householdInvitation.create({
      data: {
        householdId,
        email: normalizeEmail(email),
        tokenHash,
        invitedById,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        householdId,
        userId: invitedById,
        action: 'INVITATION_CREATED',
        entityType: 'HouseholdInvitation',
        entityId: invitation.id,
        metadata: { email: invitation.email },
      },
    });

    await this.mailService.sendInvitationEmail({
      to: invitation.email,
      householdName: household.name,
      invitationToken: rawToken,
    });

    return { ...invitation, token: rawToken };
  }

  async listForHousehold(householdId: string) {
    return this.prisma.householdInvitation.findMany({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async accept(rawToken: string, userId: string, userEmail: string) {
    const tokenHash = this.hashToken(rawToken);
    const invitation = await this.prisma.householdInvitation.findUnique({ where: { tokenHash } });

    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw new AppException(
        HttpStatus.GONE,
        'INVITATION_INVALID',
        'Cette invitation est invalide, déjà utilisée ou expirée.',
      );
    }

    if (normalizeEmail(invitation.email) !== normalizeEmail(userEmail)) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'INVITATION_EMAIL_MISMATCH',
        'Cette invitation a été envoyée à une autre adresse email.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.householdInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      const existingMembership = await tx.householdMember.findUnique({
        where: { householdId_userId: { householdId: invitation.householdId, userId } },
      });
      if (existingMembership) {
        return existingMembership;
      }

      return tx.householdMember.create({
        data: { householdId: invitation.householdId, userId, role: HouseholdRole.MEMBER },
      });
    });
  }

  async revoke(invitationId: string, requesterId: string): Promise<void> {
    const invitation = await this.prisma.householdInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) {
      throw new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', "Cette invitation n'existe pas.");
    }

    const requesterMembership = await this.prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId: invitation.householdId, userId: requesterId } },
    });
    if (
      !requesterMembership ||
      (requesterMembership.role !== HouseholdRole.OWNER &&
        requesterMembership.role !== HouseholdRole.ADMIN)
    ) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'FORBIDDEN',
        'Seuls les propriétaires et administrateurs peuvent révoquer une invitation.',
      );
    }

    if (invitation.acceptedAt) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'INVITATION_ALREADY_ACCEPTED',
        'Cette invitation a déjà été acceptée.',
      );
    }

    await this.prisma.householdInvitation.delete({ where: { id: invitationId } });
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
