/** État dérivé (jamais stocké tel quel) à partir de `expiresAt`/`acceptedAt`/`revokedAt`. */
export const INVITATION_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

/**
 * Forme exacte renvoyée par `InvitationsService` (apps/api/src/invitations) —
 * `codeHash` n'est jamais exposé (docs/NOTRE_NID_PRD.md section 18).
 * `email` est facultatif : le code d'invitation (Bloc 2) ne cible plus une adresse
 * précise ; l'email reste possible en complément optionnel (notification best-effort).
 */
export interface HouseholdInvitation {
  id: string;
  householdId: string;
  email: string | null;
  invitedById: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  status: InvitationStatus;
}

/**
 * Renvoyé uniquement par `POST /households/:householdId/invitations`. Le code en clair
 * n'est jamais renvoyé ailleurs (ni par la liste, ni par aucune autre route) : c'est la
 * seule occasion de le lire côté serveur, à charge pour l'inviteur de le partager.
 * `emailDelivered` vaut `null` lorsque aucun email n'a été demandé.
 */
export interface HouseholdInvitationWithCode extends HouseholdInvitation {
  code: string;
  emailDelivered: boolean | null;
}
