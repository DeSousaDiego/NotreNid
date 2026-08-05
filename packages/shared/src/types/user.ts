/** Représentation JSON (post-sérialisation) d'un utilisateur — jamais de `passwordHash`. */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
