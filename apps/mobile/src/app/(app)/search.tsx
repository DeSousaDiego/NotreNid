import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  ItemCard,
  ItemCardSkeleton,
  ScreenContainer,
  SearchField,
} from '../../components';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useItems } from '../../hooks/useItems';
import { getErrorMessage } from '../../lib/errorMessage';
import { useHousehold } from '../../providers/HouseholdProvider';
import { useTheme } from '../../theme';

export default function SearchScreen() {
  const theme = useTheme();
  const { householdId } = useHousehold();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const trimmedSearch = debouncedSearch.trim();

  const filters = useMemo(() => ({ search: trimmedSearch || undefined }), [trimmedSearch]);
  const itemsQuery = useItems(trimmedSearch ? householdId : null, filters);
  const items = itemsQuery.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View style={{ marginBottom: theme.spacing.md }}>
        <SearchField
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
          placeholder="Titre, auteur, artiste, réalisateur…"
        />
      </View>

      {!trimmedSearch ? (
        <EmptyState
          icon="search-outline"
          title="Recherchez dans votre nid"
          message="Titre, auteur, artiste, album, réalisateur ou ISBN."
        />
      ) : itemsQuery.isLoading ? (
        <View style={{ gap: theme.spacing.sm }}>
          <ItemCardSkeleton />
          <ItemCardSkeleton />
        </View>
      ) : itemsQuery.isError ? (
        <ErrorState
          message={getErrorMessage(itemsQuery.error)}
          onRetry={() => void itemsQuery.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState icon="leaf-outline" title="Aucun objet ne correspond à cette recherche." />
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
          ListFooterComponent={
            itemsQuery.isFetchingNextPage ? (
              <ActivityIndicator style={{ marginTop: theme.spacing.md }} color={theme.colors.primary} />
            ) : null
          }
        />
      )}
    </ScreenContainer>
  );
}
