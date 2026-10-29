import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  AppText,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  ItemCard,
  ItemCardSkeleton,
  ScreenContainer,
  SearchField,
} from '../../../../components';
import { CONDITION_INFO } from '../../../../constants/condition';
import { useCategories } from '../../../../hooks/useCategories';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue';
import { useItems } from '../../../../hooks/useItems';
import { useMembers } from '../../../../hooks/useMembers';
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
  const membersQuery = useMembers(householdId);
  // Hauteur réelle de la tab bar (zone système incluse), mesurée par la navigation :
  // la dernière carte la passait dessous avec l'ancienne estimation partagée.
  // `expo-router/js-tabs` est le point d'entrée public de la tab bar qu'utilise
  // l'app (Expo Router embarque sa propre copie de `@react-navigation/bottom-tabs`,
  // non installé ici : le hook de ce paquet lirait un autre contexte et lèverait).
  const tabBarHeight = useBottomTabBarHeight();

  // ─── DEBUG TEMPORAIRE (layout du bas de Collection) — ne pas commiter ───
  const debugListRef = useRef<FlatList>(null);
  const { height: debugWindowHeight } = useWindowDimensions();
  const [debug, setDebug] = useState<Record<string, number>>({});
  const recordDebug = (patch: Record<string, number>) => {
    setDebug((previous) => {
      const next = { ...previous, ...patch };
      if (__DEV__) console.warn('[CollectionLayoutDebug]', JSON.stringify(next));
      return next;
    });
  };
  // ────────────────────────────────────────────────────────────────────────

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

  // Filtres choisis dans l'écran Filtres et invisibles autrement : propriétaire,
  // état, et une catégorie absente des chips rapides (catégorie personnalisée).
  // Une catégorie système sélectionnée est déjà visible (chip active) : ni pastille
  // ni badge pour elle.
  const pills: { key: string; label: string; onRemove: () => void }[] = [];
  const { categoryId } = activeFilters;
  if (categoryId && !categories.some((c) => c.id === categoryId)) {
    pills.push({
      key: 'category',
      label: categoriesQuery.data?.find((c) => c.id === categoryId)?.name ?? 'Catégorie',
      onRemove: () => setActiveFilters({ ...activeFilters, categoryId: undefined }),
    });
  }
  if (activeFilters.ownerId) {
    const owner = membersQuery.data?.find((m) => m.user.id === activeFilters.ownerId);
    pills.push({
      key: 'owner',
      label: owner ? `À ${owner.user.displayName}` : 'Un propriétaire',
      onRemove: () => setActiveFilters({ ...activeFilters, ownerId: undefined }),
    });
  }
  if (activeFilters.condition) {
    pills.push({
      key: 'condition',
      label: CONDITION_INFO[activeFilters.condition].label,
      onRemove: () => setActiveFilters({ ...activeFilters, condition: undefined }),
    });
  }
  const activeFilterCount = pills.length;
  // Distinct du badge : une catégorie choisie par chip rapide restreint bien la liste
  // (« aucun résultat » plutôt que « nid vide »), même si le badge ne la compte pas.
  const isNarrowed = Boolean(
    filters.search || activeFilters.categoryId || activeFilters.ownerId || activeFilters.condition,
  );

  return (
    <ScreenContainer edges={['left', 'right']}>
      {/* En-tête de taille fixe (`flexShrink: 0`) : la liste en dessous est la seule
          zone qui s'adapte à la hauteur restante. */}
      <View
        // DEBUG TEMPORAIRE — ne pas commiter.
        onLayout={(event) =>
          recordDebug({
            headerY: event.nativeEvent.layout.y,
            headerHeight: event.nativeEvent.layout.height,
          })
        }
        testID="collection-header"
        style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.md, flexShrink: 0 }}
      >
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

        {/* Un `ScrollView` horizontal a par défaut `flexGrow: 1` / `flexShrink: 1` : dans
            une colonne, il peut absorber la hauteur de ses voisins (piège React Native
            connu, invisible sous Jest qui ne calcule aucune mise en page). Sa hauteur est
            figée sur celle des chips pour que les pastilles en dessous restent visibles. */}
        <ScrollView
          testID="collection-category-chips"
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
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

        {pills.length > 0 ? (
          <View
            testID="collection-active-filters"
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.xs,
              flexShrink: 0,
            }}
          >
            {pills.map((pill) => (
              <ActiveFilterPill key={pill.key} label={pill.label} onRemove={pill.onRemove} />
            ))}
          </View>
        ) : null}
      </View>

      {itemsQuery.isLoading ? (
        <View testID="collection-loading-skeleton" style={{ gap: theme.spacing.sm }}>
          {[0, 1, 2, 3].map((key) => (
            <ItemCardSkeleton key={key} />
          ))}
        </View>
      ) : itemsQuery.isError && !itemsQuery.data ? (
        // Données d'abord (même règle qu'Accueil/Archives) : un pull-to-refresh ou un
        // `fetchNextPage` en échec passe la query en erreur (TanStack Query v5) tout en
        // conservant les pages déjà chargées — elles restent affichées. L'écran
        // d'erreur ne remplace la liste que si rien n'a jamais pu être chargé.
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
            isNarrowed
              ? 'Aucun objet ne correspond à votre recherche.'
              : 'Votre nid est encore vide.'
          }
          message={
            isNarrowed
              ? 'Essayez de modifier votre recherche ou vos filtres.'
              : 'Ajoutez votre premier trésor.'
          }
        />
      ) : (
        <FlatList
          ref={debugListRef}
          // DEBUG TEMPORAIRE : viewport réel de la liste (layout local + position fenêtre).
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            recordDebug({
              tabBarHeight,
              paddingBottom: tabBarHeight + theme.spacing.sm,
              windowHeight: debugWindowHeight,
              listLayoutY: y,
              listViewportHeight: height,
            });
            const native = debugListRef.current?.getNativeScrollRef() as unknown as {
              measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
            } | null;
            native?.measureInWindow?.((_x, windowY, _w, windowH) => {
              recordDebug({
                listWindowTop: windowY,
                listWindowBottom: windowY + windowH,
                tabBarTopInWindow: debugWindowHeight - tabBarHeight,
              });
            });
          }}
          onContentSizeChange={(_width, height) => recordDebug({ contentHeight: height })}
          testID="collection-item-list"
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            gap: theme.spacing.sm,
            paddingBottom: tabBarHeight + theme.spacing.sm,
          }}
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
            <>
              {itemsQuery.isFetchingNextPage ? (
                <ActivityIndicator
                  testID="collection-pagination-spinner"
                  style={{ marginTop: theme.spacing.md }}
                  color={theme.colors.primary}
                />
              ) : null}
              {/* DEBUG TEMPORAIRE — ne pas commiter. Couleurs en dur volontaires. */}
              <View
                testID="debug-list-footer"
                onLayout={(event) =>
                  recordDebug({
                    footerY: event.nativeEvent.layout.y,
                    footerHeight: event.nativeEvent.layout.height,
                  })
                }
                style={{
                  height: 200,
                  backgroundColor: '#FF00FF',
                  borderWidth: 4,
                  borderColor: '#00FF00',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 8,
                }}
              >
                <Text style={{ color: '#000000', fontSize: 18, fontWeight: 'bold' }}>
                  DEBUG LIST FOOTER
                </Text>
                {Object.entries(debug).map(([key, value]) => (
                  <Text key={key} style={{ color: '#000000', fontSize: 11 }}>
                    {key}: {Math.round(value)}
                  </Text>
                ))}
                <Text style={{ color: '#000000', fontSize: 18, fontWeight: 'bold' }}>
                  ▼ FIN DU FOOTER ▼
                </Text>
              </View>
            </>
          }
        />
      )}
    </ScreenContainer>
  );
}

/** Pastille sauge d'un filtre actif, retirable d'un tap (zone tactile portée à
 * 44 pt par `hitSlop` sans alourdir la pastille). */
function ActiveFilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Retirer le filtre : ${label}`}
      onPress={onRemove}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        maxWidth: '100%',
        minHeight: 32,
        paddingLeft: theme.spacing.md,
        paddingRight: theme.spacing.sm,
        borderRadius: theme.radii.full,
        backgroundColor: theme.colors.tintSage,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <AppText variant="label" color="primary" numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </AppText>
      <Ionicons name="close" size={theme.iconSizes.sm} color={theme.colors.primary} />
    </Pressable>
  );
}
