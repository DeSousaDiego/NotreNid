import type { ItemsQueryParams } from '@notre-nid/shared';

/**
 * Query keys centralisées (docs/NOTRE_NID_PRD.md — cohérence du cache TanStack Query).
 *
 * Toutes préfixées par l'id de l'utilisateur courant : défense en profondeur contre la
 * réutilisation de données d'un compte par un autre après un changement de session
 * (voir docs/PHASE_STATUS.md). `AuthProvider` vide déjà tout le cache au logout — ce
 * namespacing garantit qu'un oubli de `clear()`/`invalidateQueries` ou une réponse
 * réseau résiduelle ne peuvent de toute façon jamais atterrir sous la clé que lit un
 * autre utilisateur.
 */
export const queryKeys = {
  households: (userId: string) => ['users', userId, 'households'] as const,
  members: (userId: string, householdId: string) =>
    ['users', userId, 'households', householdId, 'members'] as const,
  categories: (userId: string, householdId: string) =>
    ['users', userId, 'households', householdId, 'categories'] as const,
  items: (userId: string, householdId: string, query: ItemsQueryParams) =>
    ['users', userId, 'households', householdId, 'items', query] as const,
  /** Préfixe commun à toutes les variantes de `items` (filtres/pages) — cible générique d'invalidation. */
  itemsRoot: (userId: string, householdId: string) =>
    ['users', userId, 'households', householdId, 'items'] as const,
  item: (userId: string, householdId: string, itemId: string) =>
    ['users', userId, 'households', householdId, 'items', itemId] as const,
  stats: (userId: string, householdId: string) =>
    ['users', userId, 'households', householdId, 'stats'] as const,
  invitations: (userId: string, householdId: string) =>
    ['users', userId, 'households', householdId, 'invitations'] as const,
};
