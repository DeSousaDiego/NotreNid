import { router } from 'expo-router';
import { FlatList, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  ItemCard,
  ItemCardSkeleton,
  ScreenContainer,
} from '../../../components';
import { useItems } from '../../../hooks/useItems';
import { getErrorMessage } from '../../../lib/errorMessage';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { useTheme } from '../../../theme';

/** Consultation des items archivés (docs/NOTRE_NID_PRD.md section 9, « Profil et paramètres »). */
export default function ArchivesScreen() {
  const theme = useTheme();
  const { householdId } = useHousehold();
  const itemsQuery = useItems(householdId, { archived: true, sort: 'updatedAt', order: 'desc' });

  const items = itemsQuery.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      {itemsQuery.isLoading ? (
        <View>
          {[0, 1, 2].map((key) => (
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
          icon="archive-outline"
          title="Aucun objet archivé"
          message="Les objets que vous archivez apparaîtront ici, restaurables à tout moment."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: theme.spacing.lg,
            gap: theme.spacing.sm,
            paddingBottom: theme.spacing.xl,
          }}
          renderItem={({ item }) => (
            <ItemCard
              item={item}
              onPress={() =>
                router.push({ pathname: '/(app)/collection/[itemId]', params: { itemId: item.id } })
              }
            />
          )}
          refreshing={itemsQuery.isRefetching}
          onRefresh={() => void itemsQuery.refetch()}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (itemsQuery.hasNextPage && !itemsQuery.isFetchingNextPage) {
              void itemsQuery.fetchNextPage();
            }
          }}
        />
      )}
    </ScreenContainer>
  );
}
