import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

const DESCRIPTIONS: Record<number, string> = {
  400: 'Les données envoyées sont invalides.',
  401: "L'utilisateur n'est pas authentifié, ou le token est invalide ou expiré.",
  403: "L'utilisateur n'a pas les droits nécessaires pour effectuer cette action.",
  404: "La ressource demandée n'existe pas, ou n'appartient pas à ce household.",
  409: "La requête entre en conflit avec l'état actuel de la ressource.",
  429: 'Trop de requêtes ont été envoyées dans un court instant.',
};

/**
 * Documente dans Swagger les réponses d'erreur standard (section 18 du PRD :
 * `{ statusCode, code, message, details, requestId }`) communes à la plupart des
 * routes, sans dupliquer les mêmes `@ApiResponse` sur chaque contrôleur.
 */
export function ApiStandardErrors(...statusCodes: number[]): ClassDecorator & MethodDecorator {
  return applyDecorators(
    ...statusCodes.map((status) =>
      ApiResponse({ status, description: DESCRIPTIONS[status] ?? 'Erreur.' }),
    ),
  );
}
