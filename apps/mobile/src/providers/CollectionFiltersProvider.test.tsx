import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
  DEFAULT_COLLECTION_FILTERS,
  HouseholdCollectionFiltersProvider,
  useCollectionFilters,
} from './CollectionFiltersProvider';

describe('HouseholdCollectionFiltersProvider', () => {
  it('drops the filters of household A when the user switches to household B', async () => {
    let householdId = 'household-a';
    const wrapper = ({ children }: { children: ReactNode }) => (
      <HouseholdCollectionFiltersProvider householdId={householdId}>
        {children}
      </HouseholdCollectionFiltersProvider>
    );
    const { result, rerender } = await renderHook(() => useCollectionFilters(), { wrapper });

    await act(async () => {
      result.current.setFilters({
        ...DEFAULT_COLLECTION_FILTERS,
        ownerId: 'owner-of-a',
        categoryId: 'category-of-a',
      });
    });
    expect(result.current.filters.ownerId).toBe('owner-of-a');

    householdId = 'household-b';
    await rerender({});

    expect(result.current.filters).toEqual(DEFAULT_COLLECTION_FILTERS);
  });

  it('keeps the filters while the household stays the same', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <HouseholdCollectionFiltersProvider householdId="household-a">
        {children}
      </HouseholdCollectionFiltersProvider>
    );
    const { result, rerender } = await renderHook(() => useCollectionFilters(), { wrapper });

    await act(async () => {
      result.current.setFilters({ ...DEFAULT_COLLECTION_FILTERS, ownerId: 'owner-of-a' });
    });
    await rerender({});

    expect(result.current.filters.ownerId).toBe('owner-of-a');
  });
});
