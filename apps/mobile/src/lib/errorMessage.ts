import { ApiError, NetworkError } from '@notre-nid/api-client';

import { SharingUnavailableError } from './exportFile';

/**
 * Messages mobiles substitués à ceux de l'API pour certains codes : le message serveur
 * reste générique (et emploie le vocabulaire technique « household »), celui-ci est
 * formulé pour la personne qui le lit dans l'app.
 */
const API_ERROR_MESSAGES: Record<string, string> = {
  LAST_OWNER_CANNOT_LEAVE:
    'Vous êtes la seule personne responsable de ce foyer : confiez-le d’abord à quelqu’un d’autre.',
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) return error.message;
  if (error instanceof ApiError) return API_ERROR_MESSAGES[error.code] ?? error.message;
  if (error instanceof SharingUnavailableError) return error.message;
  return "Une erreur inattendue s'est produite.";
}

/** Vrai 404 renvoyé par l'API (ressource absente ou hors du foyer courant) — jamais
 * une erreur réseau ni une panne serveur, qui doivent rester « réessayables ». */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 404;
}
