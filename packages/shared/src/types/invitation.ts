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

/**
 * Renvoyé uniquement par `POST /households/:householdId/invitations`. Le jeton en
 * clair est toujours inclus (pour permettre à l'inviteur de partager le lien
 * manuellement) ; `emailDelivered` indique si l'envoi de l'email a réellement abouti.
 */
export interface HouseholdInvitationWithToken extends HouseholdInvitation {
  token: string;
  emailDelivered: boolean;
}
