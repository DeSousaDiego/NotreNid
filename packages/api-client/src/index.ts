/**
 * Client API typé pour l'application mobile. Centralise la configuration
 * réseau, l'authentification, le rafraîchissement des tokens et la gestion
 * des erreurs (docs/NOTRE_NID_PRD.md section 3, « API client partagé »).
 */

export { createApiClient, type ApiClient } from './client';
export { ApiError, NetworkError } from './errors';
export type { ApiClientConfig, StoredTokens, TokenStorage } from './types';
export type { LoginInput, RegisterInput } from './endpoints/auth';
