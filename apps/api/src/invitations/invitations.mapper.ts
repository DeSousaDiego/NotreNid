import type { HouseholdInvitation } from '@prisma/client';

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface PublicInvitation {
  id: string;
  householdId: string;
  email: string | null;
  invitedById: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  status: InvitationStatus;
}

export function invitationStatus(invitation: HouseholdInvitation): InvitationStatus {
  if (invitation.acceptedAt) return 'accepted';
  if (invitation.revokedAt) return 'revoked';
  if (invitation.expiresAt < new Date()) return 'expired';
  return 'pending';
}

/** Ne renvoie jamais `codeHash` : à utiliser systématiquement avant toute réponse HTTP. */
export function toPublicInvitation(invitation: HouseholdInvitation): PublicInvitation {
  return {
    id: invitation.id,
    householdId: invitation.householdId,
    email: invitation.email,
    invitedById: invitation.invitedById,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    revokedAt: invitation.revokedAt,
    createdAt: invitation.createdAt,
    status: invitationStatus(invitation),
  };
}
