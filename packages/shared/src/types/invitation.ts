/**
 * Forme exacte renvoyée par `InvitationsService` (apps/api/src/invitations) —
 * `tokenHash` n'est jamais exposé (docs/NOTRE_NID_PRD.md section 18).
 */
export interface HouseholdInvitation {
  id: string;
  householdId: string;
  email: string;
  invitedById: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

/** Renvoyé uniquement par `POST /households/:householdId/invitations` (jeton en clair, développement uniquement). */
export interface HouseholdInvitationWithToken extends HouseholdInvitation {
  token: string;
}
