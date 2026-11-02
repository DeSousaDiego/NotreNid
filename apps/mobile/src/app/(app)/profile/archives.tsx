import { router } from 'expo-router';
import { useRef } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  ItemCard,
  ItemCardSkeleton,
  ScreenContainer,
} from '../../../components';
import { useItems } from '../../../hooks/useItems';
import { getErrorMessage } from '../../../lib/errorMessage';
import { uniqueById } from '../../../lib/uniqueById';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { useTheme } from '../../../theme';

/** Consultation des items archivés (docs/NOTRE_NID_PRD.md section 9, « Profil et paramètres »). */
export default function ArchivesScreen() {
  const theme = useTheme();
  const { householdId } = useHousehold();
  const itemsQuery = useItems(householdId, { archived: true, sort: 'updatedAt', order: 'desc' });

  const items = uniqueById(itemsQuery.data?.pages.map((page) => page.data) ?? []);
  // Verrou synchrone (même principe que la Collection) : `onEndReached` peut être appelé deux
  // fois avant que `isFetchingNextPage` ne se reflète au rendu suivant.
  const isFetchingNextPageRef = useRef(false);

  return (
    // `flex: 1` (et non le `flexGrow: 1` par défaut) : sans hauteur contrainte, la FlatList
    // prenait la hauteur de son contenu et les derniers objets archivés devenaient
    // inaccessibles — même cause que le bug corrigé sur la Collection. Écran de pile, sans
    // tab bar : la safe area du bas (`edges`) suffit, aucune compensation à calculer.
    <ScreenContainer edges={['left', 'right', 'bottom']} contentStyle={{ flex: 1 }}>
      {itemsQuery.isLoading ? (
        <View testID="archives-loading-skeleton" style={{ gap: theme.spacing.sm }}>
          {[0, 1, 2].map((key) => (
            <ItemCardSkeleton key={key} />
          ))}
        </View>
      ) : itemsQuery.isError && !itemsQuery.data ? (
        // Données d'abord : un refetch en échec (TanStack Query v5 garde `data`) ne
        // remplace jamais une liste déjà affichée par un écran d'erreur.
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
          testID="archives-item-list"
          style={{ flex: 1 }}
          // Le padding horizontal vient déjà de `ScreenContainer` (même alignement que
          // la Collection) : ne pas le doubler ici.
          contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.sm }}
          renderItem={({ item }) => (
            <ItemCard
              item={item}
              onPress={() =>
                router.push({ pathname: '/(app)/collection/[itemId]', params: { itemId: item.id } })
              }
            />
          )}
          refreshing={itemsQuery.isRefetching && !itemsQuery.isFetchingNextPage}
          onRefresh={() => void itemsQuery.refetch()}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (!itemsQuery.hasNextPage || isFetchingNextPageRef.current) return;
            isFetchingNextPageRef.current = true;
            void itemsQuery.fetchNextPage().finally(() => {
              isFetchingNextPageRef.current = false;
            });
          }}
          ListFooterComponent={
            itemsQuery.isFetchingNextPage ? (
              <ActivityIndicator
                testID="archives-pagination-spinner"
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
