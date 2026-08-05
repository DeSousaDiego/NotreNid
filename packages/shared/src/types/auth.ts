import type { PublicUser } from './user';

/** Forme exacte renvoyée par `AuthService.register/login/refresh` (apps/api/src/auth/auth.service.ts). */
export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}
