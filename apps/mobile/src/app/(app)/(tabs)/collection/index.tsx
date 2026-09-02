import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  IconButton,
  ItemCard,
  ItemCardSkeleton,
  ScreenContainer,
  SearchField,
} from '../../../../components';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue';
import { useItems } from '../../../../hooks/useItems';
import { useTabBarClearance } from '../../../../hooks/useTabBarClearance';
import { getErrorMessage } from '../../../../lib/errorMessage';
import { useCollectionFilters } from '../../../../providers/CollectionFiltersProvider';
import { useHousehold } from '../../../../providers/HouseholdProvider';
import { useTheme } from '../../../../theme';

export default function CollectionScreen() {
  const theme = useTheme();
  const { householdId } = useHousehold();
  const { filters: activeFilters } = useCollectionFilters();
  const tabBarClearance = useTabBarClearance();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const filters = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      ...activeFilters,
    }),
    [debouncedSearch, activeFilters],
  );

  const itemsQuery = useItems(householdId, filters);

  const items = itemsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const activeFilterCount = [
    activeFilters.categoryId,
    activeFilters.condition,
    activeFilters.ownerId,
  ].filter(Boolean).length;

  return (
    <ScreenContainer edges={['left', 'right']}>
      <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <SearchField value={search} onChangeText={setSearch} onClear={() => setSearch('')} />
          </View>
          <IconButton
            name="options-outline"
            accessibilityLabel={`Filtres${activeFilterCount > 0 ? ` (${activeFilterCount} actifs)` : ''}`}
            color={activeFilterCount > 0 ? 'secondary' : 'text'}
            onPress={() => router.push('/(app)/collection/filters')}
          />
        </View>
      </View>

      {itemsQuery.isLoading ? (
        <View style={{ gap: theme.spacing.sm }}>
          {[0, 1, 2, 3].map((key) => (
            <ItemCardSkeleton key={key} />
          ))}
        </View>
      ) : itemsQuery.isError ? (
        <ErrorState
          message={getErrorMessage(itemsQuery.error)}
          onRetry={() => void itemsQuery.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="leaf-outline"
          title="Votre nid est encore vide."
          message={
            filters.search || activeFilterCount > 0
              ? 'Aucun objet ne correspond à cette recherche.'
              : 'Ajoutez votre premier trésor.'
          }
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: tabBarClearance }}
          renderItem={({ item }) => (
            <ItemCard
              item={item}
              onPress={() =>
                router.push({ pathname: '/(app)/collection/[itemId]', params: { itemId: item.id } })
              }
            />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (itemsQuery.hasNextPage && !itemsQuery.isFetchingNextPage) {
              void itemsQuery.fetchNextPage();
            }
          }}
          refreshing={itemsQuery.isRefetching && !itemsQuery.isFetchingNextPage}
          onRefresh={() => void itemsQuery.refetch()}
          ListFooterComponent={
            itemsQuery.isFetchingNextPage ? (
              <ActivityIndicator
                style={{ marginTop: theme.spacing.md }}
                color={theme.colors.primary}
              />
            ) : null
          }
        />
      )}
    </ScreenContainer>
  );
}
