import type { paths } from './generated/schema';

/**
 * Vérification de cohérence entre le client manuscrit (`src/endpoints/*.ts`) et
 * le contrat OpenAPI réellement exposé par l'API (`docs/openapi.json`, régénéré
 * via `pnpm --filter @notre-nid/api run export:openapi` puis
 * `pnpm --filter @notre-nid/api-client run generate:types`).
 *
 * N'étant pas un client généré (voir docs/DECISIONS.md), ce fichier ne remplace
 * pas `endpoints/*.ts` : il échoue à la compilation (`pnpm typecheck`) si une
 * route ou une méthode HTTP attendue disparaît du contrat, détectant ainsi
 * toute dérive entre l'API et le client sans avoir à réécrire ce dernier.
 */

type MethodExists<
  Path extends keyof paths,
  Method extends keyof paths[Path],
> = paths[Path][Method] extends undefined ? false : true;

type ExpectTrue<_T extends true> = never;

export type ApiClientContractChecks = [
  // Auth
  ExpectTrue<MethodExists<'/auth/register', 'post'>>,
  ExpectTrue<MethodExists<'/auth/login', 'post'>>,
  ExpectTrue<MethodExists<'/auth/refresh', 'post'>>,
  ExpectTrue<MethodExists<'/auth/logout', 'post'>>,
  ExpectTrue<MethodExists<'/auth/logout-all', 'post'>>,
  ExpectTrue<MethodExists<'/auth/me', 'get'>>,

  // Health
  ExpectTrue<MethodExists<'/health', 'get'>>,
  ExpectTrue<MethodExists<'/health/ready', 'get'>>,

  // Households + membres
  ExpectTrue<MethodExists<'/households', 'get'>>,
  ExpectTrue<MethodExists<'/households', 'post'>>,
  ExpectTrue<MethodExists<'/households/{householdId}', 'get'>>,
  ExpectTrue<MethodExists<'/households/{householdId}', 'patch'>>,
  ExpectTrue<MethodExists<'/households/{householdId}', 'delete'>>,
  ExpectTrue<MethodExists<'/households/{householdId}/members', 'get'>>,
  ExpectTrue<MethodExists<'/households/{householdId}/members/{userId}', 'patch'>>,
  ExpectTrue<MethodExists<'/households/{householdId}/members/{userId}', 'delete'>>,
  ExpectTrue<MethodExists<'/households/{householdId}/leave', 'post'>>,

  // Invitations
  ExpectTrue<MethodExists<'/households/{householdId}/invitations', 'post'>>,
  ExpectTrue<MethodExists<'/households/{householdId}/invitations', 'get'>>,
  ExpectTrue<MethodExists<'/invitations/accept', 'post'>>,
  ExpectTrue<MethodExists<'/invitations/{invitationId}/revoke', 'post'>>,

  // Catégories
  ExpectTrue<MethodExists<'/households/{householdId}/categories', 'get'>>,
  ExpectTrue<MethodExists<'/households/{householdId}/categories', 'post'>>,
  ExpectTrue<MethodExists<'/households/{householdId}/categories/{categoryId}', 'patch'>>,
  ExpectTrue<MethodExists<'/households/{householdId}/categories/{categoryId}', 'delete'>>,

  // Items
  ExpectTrue<MethodExists<'/households/{householdId}/items', 'get'>>,
  ExpectTrue<MethodExists<'/households/{householdId}/items', 'post'>>,
  ExpectTrue<MethodExists<'/households/{householdId}/items/{itemId}', 'get'>>,
  ExpectTrue<MethodExists<'/households/{householdId}/items/{itemId}', 'patch'>>,
  ExpectTrue<MethodExists<'/households/{householdId}/items/{itemId}', 'delete'>>,
  ExpectTrue<MethodExists<'/households/{householdId}/items/{itemId}/restore', 'post'>>,

  // Uploads
  ExpectTrue<MethodExists<'/households/{householdId}/uploads', 'post'>>,
  ExpectTrue<MethodExists<'/households/{householdId}/uploads/{uploadId}', 'delete'>>,

  // Stats + exports
  ExpectTrue<MethodExists<'/households/{householdId}/stats', 'get'>>,
  ExpectTrue<MethodExists<'/households/{householdId}/exports/json', 'get'>>,
  ExpectTrue<MethodExists<'/households/{householdId}/exports/csv', 'get'>>,

  // Profil utilisateur (Bloc 4)
  ExpectTrue<MethodExists<'/users/me', 'patch'>>,
  ExpectTrue<MethodExists<'/users/me/avatar', 'post'>>,
  ExpectTrue<MethodExists<'/users/me/avatar', 'delete'>>,
];
