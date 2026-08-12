import type { ItemsQueryParams } from '@notre-nid/shared';

/** Query keys centralisées (docs/NOTRE_NID_PRD.md — cohérence du cache TanStack Query). */
export const queryKeys = {
  me: ['me'] as const,
  households: ['households'] as const,
  household: (householdId: string) => ['households', householdId] as const,
  members: (householdId: string) => ['households', householdId, 'members'] as const,
  categories: (householdId: string) => ['households', householdId, 'categories'] as const,
  items: (householdId: string, query: ItemsQueryParams) =>
    ['households', householdId, 'items', query] as const,
  /** Préfixe commun à toutes les variantes de `items` (filtres/pages) — cible générique d'invalidation. */
  itemsRoot: (householdId: string) => ['households', householdId, 'items'] as const,
  item: (householdId: string, itemId: string) =>
    ['households', householdId, 'items', itemId] as const,
  stats: (householdId: string) => ['households', householdId, 'stats'] as const,
  invitations: (householdId: string) => ['households', householdId, 'invitations'] as const,
};
