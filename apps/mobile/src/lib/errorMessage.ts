import { ApiError, NetworkError } from '@notre-nid/api-client';

export function getErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) return error.message;
  if (error instanceof ApiError) return error.message;
  return "Une erreur inattendue s'est produite.";
}
