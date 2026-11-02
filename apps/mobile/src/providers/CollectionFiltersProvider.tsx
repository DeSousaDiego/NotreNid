import type { ItemCondition, ItemSortField } from '@notre-nid/shared';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface CollectionFiltersState {
  categoryId: string | undefined;
  condition: ItemCondition | undefined;
  ownerId: string | undefined;
  sort: ItemSortField;
  order: 'asc' | 'desc';
}

export const DEFAULT_COLLECTION_FILTERS: CollectionFiltersState = {
  categoryId: undefined,
  condition: undefined,
  ownerId: undefined,
  sort: 'createdAt',
  order: 'desc',
};

interface CollectionFiltersContextValue {
  filters: CollectionFiltersState;
  setFilters: (filters: CollectionFiltersState) => void;
}

const CollectionFiltersContext = createContext<CollectionFiltersContextValue | null>(null);

/**
 * Partagé entre `collection/index.tsx` et l'écran dédié `collection/filters.tsx`
 * (docs/PHASE_STATUS.md — remplace l'ancienne bottom sheet, qui empilait un second
 * sheet à chaque `Select` ouvert par-dessus le premier sur petits écrans).
 */
export function CollectionFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<CollectionFiltersState>(DEFAULT_COLLECTION_FILTERS);

  const value = useMemo<CollectionFiltersContextValue>(() => ({ filters, setFilters }), [filters]);

  return (
    <CollectionFiltersContext.Provider value={value}>{children}</CollectionFiltersContext.Provider>
  );
}

/**
 * Filtres propres à UN foyer (Release 0B) : une catégorie ou un propriétaire n'existe que
 * dans son foyer. Le `key` remonte un état vierge à chaque changement de foyer, au lieu de
 * laisser un filtre de l'ancien foyer vider la Collection du nouveau.
 */
export function HouseholdCollectionFiltersProvider({
  householdId,
  children,
}: {
  householdId: string;
  children: ReactNode;
}) {
  return <CollectionFiltersProvider key={householdId}>{children}</CollectionFiltersProvider>;
}

export function useCollectionFilters(): CollectionFiltersContextValue {
  const ctx = useContext(CollectionFiltersContext);
  if (!ctx) {
    throw new Error(
      'useCollectionFilters doit être utilisé à l’intérieur de <CollectionFiltersProvider>.',
    );
  }
  return ctx;
}
