import type { ApiErrorBody } from '@notre-nid/shared';

/** Erreur renvoyée par l'API avec le format standard (docs/NOTRE_NID_PRD.md section 18). */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: unknown[];
  public readonly requestId?: string;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.statusCode = body.statusCode;
    this.code = body.code;
    this.details = body.details ?? [];
    this.requestId = body.requestId;
  }
}

/**
 * Échec de connexion réseau (API injoignable, hors ligne, timeout), distinct
 * d'une erreur applicative renvoyée par l'API. Voir docs/NOTRE_NID_PRD.md
 * section 4.10 pour le message affiché à l'utilisateur.
 */
export class NetworkError extends Error {
  constructor(message = 'Impossible de joindre le service. Vérifiez votre connexion et réessayez.') {
    super(message);
    this.name = 'NetworkError';
  }
}
