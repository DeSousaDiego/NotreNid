import { createHmac } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HouseholdInvitation } from '@prisma/client';
import { HouseholdRole, Prisma } from '@prisma/client';

import {
  generateInvitationCode,
  isValidInvitationCodeFormat,
  normalizeInvitationCode,
} from './invitation-code.util';
import { invitationStatus, toPublicInvitation, type PublicInvitation } from './invitations.mapper';
import { AppException } from '../common/exceptions/app-exception';
import { normalizeEmail } from '../common/utils/normalize-email';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours
/** Nombre de tentatives avant d'abandonner en cas de collision de code (voir `create`). */
const MAX_CODE_GENERATION_ATTEMPTS = 5;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async create(
    householdId: string,
    invitedById: string,
    email?: string,
  ): Promise<PublicInvitation & { code: string; emailDelivered: boolean | null }> {
    const household = await this.prisma.household.findUnique({ where: { id: householdId } });
    if (!household) {
      throw new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', "Ce household n'existe pas.");
    }

    // Un seul code actif par household à la fois (docs/NOTRE_NID_PRD.md, Bloc 2, section 9) :
    // en générer un nouveau invalide silencieusement l'ancien plutôt que de multiplier les
    // codes actifs pour un même usage générique.
    await this.revokeActiveInvitations(householdId);

    const normalizedEmail = email ? normalizeEmail(email) : null;
    const { invitation, rawCode } = await this.createWithUniqueCode(
      householdId,
      invitedById,
      normalizedEmail,
    );

    await this.prisma.auditLog.create({
      data: {
        householdId,
        userId: invitedById,
        action: 'INVITATION_CREATED',
        entityType: 'HouseholdInvitation',
        entityId: invitation.id,
        // Ne jamais journaliser le code en clair (docs/NOTRE_NID_PRD.md section 19/26).
        metadata: { email: normalizedEmail },
      },
    });

    let emailDelivered: boolean | null = null;
    if (normalizedEmail) {
      const result = await this.mailService.sendInvitationEmail({
        to: normalizedEmail,
        householdName: household.name,
        invitationCode: rawCode,
      });
      emailDelivered = result.delivered;
    }

    return { ...toPublicInvitation(invitation), code: rawCode, emailDelivered };
  }

  async listForHousehold(householdId: string): Promise<PublicInvitation[]> {
    const invitations = await this.prisma.householdInvitation.findMany({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
    });
    return invitations.map(toPublicInvitation);
  }

  /**
   * Rejoint un household via un code d'invitation. Distingue volontairement chaque cas
   * d'échec par un message humain précis (docs/NOTRE_NID_PRD.md, Bloc 2, section 7) — sans
   * jamais permettre à un appelant de faire la différence entre "code jamais émis" et "code
   * déjà consommé" avant d'avoir effectivement trouvé une correspondance (voir
   * docs/DECISIONS.md, section sécurité).
   */
  async accept(rawCode: string, userId: string) {
    const normalized = normalizeInvitationCode(rawCode);
    if (!isValidInvitationCodeFormat(normalized)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'INVITATION_CODE_INVALID',
        "Ce code n'est pas valide. Vérifiez qu'il est correctement saisi.",
      );
    }

    const codeHash = this.hashCode(normalized);
    const invitation = await this.prisma.householdInvitation.findUnique({ where: { codeHash } });
    if (!invitation) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'INVITATION_NOT_FOUND',
        "Ce code d'invitation est introuvable.",
      );
    }

    const status = invitationStatus(invitation);
    if (status === 'revoked') {
      throw new AppException(
        HttpStatus.GONE,
        'INVITATION_REVOKED',
        'Cette invitation a été révoquée.',
      );
    }
    if (status === 'expired') {
      throw new AppException(HttpStatus.GONE, 'INVITATION_EXPIRED', 'Cette invitation a expiré.');
    }
    if (status === 'accepted') {
      throw new AppException(
        HttpStatus.CONFLICT,
        'INVITATION_ALREADY_ACCEPTED',
        'Cette invitation a déjà été utilisée.',
      );
    }

    const existingMembership = await this.prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId: invitation.householdId, userId } },
    });
    if (existingMembership) {
      // Ne consomme pas le code : il reste disponible pour la personne réellement visée
      // par le partage (docs/NOTRE_NID_PRD.md, Bloc 2, section 7 — "utilisateur déjà membre").
      throw new AppException(
        HttpStatus.CONFLICT,
        'ALREADY_MEMBER',
        'Vous êtes déjà membre de ce foyer.',
      );
    }

    const { household, membership } = await this.prisma.$transaction(async (tx) => {
      await tx.householdInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
      const createdMembership = await tx.householdMember.create({
        data: { householdId: invitation.householdId, userId, role: HouseholdRole.MEMBER },
      });
      const joinedHousehold = await tx.household.findUniqueOrThrow({
        where: { id: invitation.householdId },
      });
      return { household: joinedHousehold, membership: createdMembership };
    });

    return {
      householdId: household.id,
      householdName: household.name,
      role: membership.role,
    };
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

    const status = invitationStatus(invitation);
    if (status === 'accepted') {
      throw new AppException(
        HttpStatus.CONFLICT,
        'INVITATION_ALREADY_ACCEPTED',
        'Cette invitation a déjà été acceptée.',
      );
    }
    if (status === 'revoked') {
      return; // Idempotent : révoquer une invitation déjà révoquée ne fait rien.
    }

    await this.prisma.householdInvitation.update({
      where: { id: invitationId },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeActiveInvitations(householdId: string): Promise<void> {
    await this.prisma.householdInvitation.updateMany({
      where: { householdId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Tire un nouveau code et tente l'écriture ; recommence en cas de collision (violation de
   * l'unicité de `codeHash`, `P2002`) plutôt que de supposer qu'elle ne peut jamais se
   * produire (docs/NOTRE_NID_PRD.md, Bloc 2, section 3 — "aucune collision silencieuse").
   * Avec ~39,6 bits d'entropie, la probabilité réelle est négligeable pour le volume
   * d'invitations actives de cette application ; ce filet n'a donc normalement jamais
   * l'occasion de boucler plus d'une fois.
   */
  private async createWithUniqueCode(
    householdId: string,
    invitedById: string,
    email: string | null,
  ): Promise<{ invitation: HouseholdInvitation; rawCode: string }> {
    for (let attempt = 1; attempt <= MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
      const rawCode = generateInvitationCode();
      try {
        const invitation = await this.prisma.householdInvitation.create({
          data: {
            householdId,
            email,
            codeHash: this.hashCode(rawCode),
            invitedById,
            expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
          },
        });
        return { invitation, rawCode };
      } catch (error) {
        const isCollision =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!isCollision || attempt === MAX_CODE_GENERATION_ATTEMPTS) {
          throw error;
        }
      }
    }
    /* istanbul ignore next -- la boucle ci-dessus retourne ou lève systématiquement */
    throw new Error('Unreachable');
  }

  /**
   * HMAC-SHA256 plutôt qu'un simple SHA-256 (voir docs/DECISIONS.md) : un code à 8
   * caractères (~39,6 bits) serait rapide à retrouver hors ligne par force brute à partir
   * d'un simple hash si la base de données venait à fuiter. La clé HMAC, dérivée de
   * JWT_ACCESS_SECRET (jamais stockée en base, uniquement en variable d'environnement),
   * rend cette attaque hors ligne impraticable même en cas de lecture accidentelle de la
   * base seule.
   */
  private hashCode(normalizedCode: string): string {
    const jwtSecret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    const pepper = createHmac('sha256', jwtSecret)
      .update('notre-nid-invitation-code-pepper')
      .digest();
    return createHmac('sha256', pepper).update(normalizedCode).digest('hex');
  }
}
