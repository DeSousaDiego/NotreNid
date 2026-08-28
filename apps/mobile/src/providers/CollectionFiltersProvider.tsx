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
  resetFilters: () => void;
}

const CollectionFiltersContext = createContext<CollectionFiltersContextValue | null>(null);

/**
 * Partagé entre `collection/index.tsx` et l'écran dédié `collection/filters.tsx`
 * (docs/PHASE_STATUS.md — remplace l'ancienne bottom sheet, qui empilait un second
 * sheet à chaque `Select` ouvert par-dessus le premier sur petits écrans).
 */
export function CollectionFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<CollectionFiltersState>(DEFAULT_COLLECTION_FILTERS);

  const value = useMemo<CollectionFiltersContextValue>(
    () => ({
      filters,
      setFilters,
      resetFilters: () => setFilters(DEFAULT_COLLECTION_FILTERS),
    }),
    [filters],
  );

  return (
    <CollectionFiltersContext.Provider value={value}>{children}</CollectionFiltersContext.Provider>
  );
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
