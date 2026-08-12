import type { HouseholdInvitation } from '@prisma/client';

export interface PublicInvitation {
  id: string;
  householdId: string;
  email: string;
  invitedById: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

/** Ne renvoie jamais `tokenHash` : à utiliser systématiquement avant toute réponse HTTP. */
export function toPublicInvitation(invitation: HouseholdInvitation): PublicInvitation {
  return {
    id: invitation.id,
    householdId: invitation.householdId,
    email: invitation.email,
    invitedById: invitation.invitedById,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    createdAt: invitation.createdAt,
  };
}
