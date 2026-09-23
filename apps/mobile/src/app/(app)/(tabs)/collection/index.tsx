import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, View } from 'react-native';

import {
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  ItemCard,
  ItemCardSkeleton,
  ScreenContainer,
  SearchField,
} from '../../../../components';
import { useCategories } from '../../../../hooks/useCategories';
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
  const { filters: activeFilters, setFilters: setActiveFilters } = useCollectionFilters();
  const categoriesQuery = useCategories(householdId);
  const categories = (categoriesQuery.data ?? []).filter((category) => category.isSystem);
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
  // Verrou synchrone (pas seulement `itemsQuery.isFetchingNextPage`, un état React
  // qui ne se reflète qu'au rendu suivant) : `onEndReached` peut être invoqué deux
  // fois de suite avant que ce re-rendu n'ait eu lieu (scroll rapide/irrégulier),
  // ce qui déclenchait bien une double requête de page suivante en pratique — même
  // principe que le verrou de scan caméra (`scanLockRef`, voir add-item/scan.tsx).
  const isFetchingNextPageRef = useRef(false);

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
            badgeCount={activeFilterCount}
            onPress={() => router.push('/(app)/collection/filters')}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.spacing.xs }}
        >
          <Chip
            label="Toutes"
            selected={activeFilters.categoryId === undefined}
            onPress={() => setActiveFilters({ ...activeFilters, categoryId: undefined })}
          />
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              selected={activeFilters.categoryId === category.id}
              onPress={() => setActiveFilters({ ...activeFilters, categoryId: category.id })}
            />
          ))}
        </ScrollView>
      </View>

      {itemsQuery.isLoading ? (
        <View testID="collection-loading-skeleton" style={{ gap: theme.spacing.sm }}>
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
        // Un titre distinct pour une bibliothèque réellement vide vs une
        // recherche/un filtre sans résultat — sinon « Votre nid est encore
        // vide. » s'affiche même quand le foyer possède déjà des dizaines
        // d'objets, simplement non retournés par la recherche/le filtre
        // courant (voir docs/PHASE_STATUS.md).
        <EmptyState
          icon="leaf-outline"
          title={
            filters.search || activeFilterCount > 0
              ? 'Aucun objet ne correspond à votre recherche.'
              : 'Votre nid est encore vide.'
          }
          message={
            filters.search || activeFilterCount > 0
              ? 'Essayez de modifier votre recherche ou vos filtres.'
              : 'Ajoutez votre premier trésor.'
          }
        />
      ) : (
        <FlatList
          testID="collection-item-list"
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
            if (!itemsQuery.hasNextPage || isFetchingNextPageRef.current) return;
            isFetchingNextPageRef.current = true;
            void itemsQuery.fetchNextPage().finally(() => {
              isFetchingNextPageRef.current = false;
            });
          }}
          refreshing={itemsQuery.isRefetching && !itemsQuery.isFetchingNextPage}
          onRefresh={() => void itemsQuery.refetch()}
          ListFooterComponent={
            itemsQuery.isFetchingNextPage ? (
              <ActivityIndicator
                testID="collection-pagination-spinner"
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
