import type { ItemCondition, ItemSortField } from '@notre-nid/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import {
  AppText,
  BottomSheet,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  ItemCard,
  ItemCardSkeleton,
  ScreenContainer,
  SearchField,
  Select,
} from '../../../components';
import { useCategories } from '../../../hooks/useCategories';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useItems } from '../../../hooks/useItems';
import { useMembers } from '../../../hooks/useMembers';
import { getErrorMessage } from '../../../lib/errorMessage';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { useTheme } from '../../../theme';

const SORT_OPTIONS: { value: ItemSortField; label: string }[] = [
  { value: 'createdAt', label: 'Date d’ajout' },
  { value: 'title', label: 'Titre' },
  { value: 'updatedAt', label: 'Dernière modification' },
  { value: 'condition', label: 'État' },
];

const CONDITION_OPTIONS: { value: ItemCondition; label: string }[] = [
  { value: 'NEW', label: 'Neuf' },
  { value: 'VERY_GOOD', label: 'Très bon état' },
  { value: 'GOOD', label: 'Bon état' },
  { value: 'FAIR', label: 'État correct' },
  { value: 'POOR', label: 'État moyen' },
];

export default function CollectionScreen() {
  const theme = useTheme();
  const { householdId } = useHousehold();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [condition, setCondition] = useState<ItemCondition | undefined>();
  const [ownerId, setOwnerId] = useState<string | undefined>();
  const [sort, setSort] = useState<ItemSortField>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filters = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      categoryId,
      condition,
      ownerId,
      sort,
      order,
    }),
    [debouncedSearch, categoryId, condition, ownerId, sort, order],
  );

  const itemsQuery = useItems(householdId, filters);
  const categoriesQuery = useCategories(householdId);
  const membersQuery = useMembers(householdId);

  const items = itemsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const activeFilterCount = [categoryId, condition, ownerId].filter(Boolean).length;

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
            onPress={() => setFiltersOpen(true)}
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
          contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.xl }}
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

      <BottomSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtres et tri"
      >
        <View style={{ gap: theme.spacing.md }}>
          <Select
            label="Catégorie"
            value={categoryId}
            onChange={setCategoryId}
            options={(categoriesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
          <Select
            label="État"
            value={condition}
            onChange={setCondition}
            options={CONDITION_OPTIONS}
          />
          <Select
            label="Propriétaire"
            value={ownerId}
            onChange={setOwnerId}
            options={(membersQuery.data ?? []).map((m) => ({
              value: m.user.id,
              label: m.user.displayName,
            }))}
          />
          <View>
            <AppText variant="label" color="textMuted" style={{ marginBottom: 6 }}>
              Trier par
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
              {SORT_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={sort === option.value}
                  onPress={() => setSort(option.value)}
                />
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
            <Chip label="Croissant" selected={order === 'asc'} onPress={() => setOrder('asc')} />
            <Chip
              label="Décroissant"
              selected={order === 'desc'}
              onPress={() => setOrder('desc')}
            />
          </View>
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}
