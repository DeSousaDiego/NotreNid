import { ApiError, NetworkError } from '@notre-nid/api-client';

import { SharingUnavailableError } from './exportFile';

export function getErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) return error.message;
  if (error instanceof ApiError) return error.message;
  if (error instanceof SharingUnavailableError) return error.message;
  return "Une erreur inattendue s'est produite.";
}
