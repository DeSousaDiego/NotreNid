import { SYSTEM_CATEGORY_SLUGS, type HouseholdStats } from '@notre-nid/shared';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import {
  AppText,
  Button,
  CategoryIllustration,
  ErrorState,
  LoadingSkeleton,
  RecentItemRow,
  RecentItemRowSkeleton,
  ScreenContainer,
} from '../../../components';
import { getCategoryTint } from '../../../constants/category-icons';
import { useItems } from '../../../hooks/useItems';
import { useStats } from '../../../hooks/useStats';
import { useTabBarClearance } from '../../../hooks/useTabBarClearance';
import { getErrorMessage } from '../../../lib/errorMessage';
import { useAuth } from '../../../providers/AuthProvider';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { useTheme } from '../../../theme';

const RECENT_ITEMS_COUNT = 5;
const RECENT_SKELETON_ROWS = 3;
/** Hauteur réelle d'une tuile (padding + illustration + nombre + libellé), partagée
 * avec son squelette pour qu'aucun saut de hauteur ne survienne au chargement. */
const STAT_TILE_HEIGHT = 120;

const STAT_CATEGORIES = [
  { slug: SYSTEM_CATEGORY_SLUGS.BOOK, singular: 'livre', plural: 'livres' },
  { slug: SYSTEM_CATEGORY_SLUGS.CD, singular: 'CD', plural: 'CD' },
  { slug: SYSTEM_CATEGORY_SLUGS.DVD, singular: 'DVD', plural: 'DVD' },
] as const;

export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { householdId, households } = useHousehold();
  const householdName = households.find((h) => h.id === householdId)?.name;
  const statsQuery = useStats(householdId);
  // Une requête dédiée (plutôt que `stats.recentAdditions`, qui n'a ni couverture ni
  // auteur) — déjà typée complète (Item), aucun changement d'API nécessaire (Bloc 4).
  const recentItemsQuery = useItems(householdId, {
    sort: 'createdAt',
    order: 'desc',
    pageSize: RECENT_ITEMS_COUNT,
    archived: false,
  });
  const tabBarClearance = useTabBarClearance();

  // `data` est toujours testé avant `isError` : en TanStack Query v5, un refetch en
  // échec passe `status` à 'error' tout en conservant la dernière donnée valide —
  // elle doit rester affichée (docs/NOTRE_NID_PRD.md section 11).
  const stats = statsQuery.data;
  const isEmptyNest = stats?.totalActiveItems === 0;

  return (
    <ScreenContainer>
      <ScrollView
        testID="home-scroll"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={statsQuery.isRefetching || recentItemsQuery.isRefetching}
            onRefresh={() => {
              void statsQuery.refetch();
              void recentItemsQuery.refetch();
            }}
          />
        }
        contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: tabBarClearance }}
      >
        <HomeHeader householdName={householdName} displayName={user?.displayName} />

        {stats ? (
          isEmptyNest ? (
            <EmptyNest onAdd={() => router.push('/(app)/add-item/category')} />
          ) : (
            <CategoryStats stats={stats} />
          )
        ) : statsQuery.isLoading ? (
          <CategoryStatsSkeleton />
        ) : statsQuery.isError ? (
          <ErrorState
            message={getErrorMessage(statsQuery.error)}
            onRetry={() => void statsQuery.refetch()}
          />
        ) : null}

        {isEmptyNest ? null : (
          <RecentItemsSection
            query={recentItemsQuery}
            onPressItem={(itemId) =>
              router.push({ pathname: '/(app)/collection/[itemId]', params: { itemId } })
            }
          />
        )}

        {isEmptyNest || statsQuery.isLoading ? null : (
          <Button
            label="Voir la collection"
            variant="primary"
            onPress={() => router.push('/collection')}
          />
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function HomeHeader({
  householdName,
  displayName,
}: {
  householdName: string | undefined;
  displayName: string | undefined;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <AppText variant="display" color="primary" accessibilityRole="header">
          Notre Nid
        </AppText>
        <Ionicons
          name="leaf"
          size={theme.iconSizes.lg}
          color={theme.colors.secondary}
          accessible={false}
          importantForAccessibility="no"
        />
      </View>

      {householdName ? (
        <View
          accessible
          accessibilityLabel={`Foyer : ${householdName}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            maxWidth: '100%',
            gap: theme.spacing.xs,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.xs,
            borderRadius: theme.radii.full,
            backgroundColor: theme.colors.tintSage,
          }}
        >
          <Ionicons name="home" size={theme.iconSizes.sm} color={theme.colors.primary} />
          <AppText variant="label" color="primary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {householdName}
          </AppText>
        </View>
      ) : null}

      <AppText variant="body" color="textMuted">
        {displayName ? `Bienvenue dans votre nid, ${displayName}.` : 'Bienvenue dans votre nid.'}
      </AppText>
    </View>
  );
}

function countForSlug(stats: HouseholdStats, slug: string): number {
  return stats.countByCategory.find((c) => c.categorySlug === slug)?.count ?? 0;
}

/** Trois petits univers Livre/CD/DVD, le total intégré au titre plutôt qu'en 4ᵉ tuile. */
function CategoryStats({ stats }: { stats: HouseholdStats }) {
  const theme = useTheme();
  const total = stats.totalActiveItems;

  return (
    <View style={{ gap: theme.spacing.md }}>
      <AppText variant="section" color="primary" accessibilityRole="header">
        {total} {total > 1 ? 'trésors' : 'trésor'} dans votre nid
      </AppText>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {STAT_CATEGORIES.map((category) => (
          <StatTile
            key={category.slug}
            slug={category.slug}
            count={countForSlug(stats, category.slug)}
            singular={category.singular}
            plural={category.plural}
          />
        ))}
      </View>
    </View>
  );
}

function StatTile({
  slug,
  count,
  singular,
  plural,
}: {
  slug: string;
  count: number;
  singular: string;
  plural: string;
}) {
  const theme = useTheme();
  // Règle française : 0 et 1 au singulier.
  const noun = count > 1 ? plural : singular;
  const label = noun.charAt(0).toUpperCase() + noun.slice(1);

  return (
    <View
      accessible
      accessibilityLabel={`${count} ${noun}`}
      style={{
        flex: 1,
        minHeight: STAT_TILE_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
        padding: theme.spacing.md,
        borderRadius: theme.radii.lg,
        backgroundColor: theme.colors[getCategoryTint(slug)],
        overflow: 'hidden',
      }}
    >
      {/* Pastille décorative en coin — simple forme, aucune information portée. */}
      <View
        style={{
          position: 'absolute',
          top: -18,
          right: -18,
          width: 56,
          height: 56,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors.surface,
          opacity: 0.55,
        }}
      />
      <CategoryIllustration slug={slug} size={36} />
      <AppText variant="title" color="primary">
        {count}
      </AppText>
      <AppText variant="label" color="text">
        {label}
      </AppText>
    </View>
  );
}

function CategoryStatsSkeleton() {
  const theme = useTheme();
  return (
    <View testID="home-stats-skeleton" style={{ gap: theme.spacing.md }}>
      <LoadingSkeleton width="60%" height={theme.typography.section.lineHeight} />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {STAT_CATEGORIES.map((category) => (
          <View key={category.slug} style={{ flex: 1 }}>
            <LoadingSkeleton height={STAT_TILE_HEIGHT} radius={theme.radii.lg} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** État vide du foyer — surface pêche, trois pastilles Livre/CD/DVD, CTA d'ajout. */
function EmptyNest({ onAdd }: { onAdd: () => void }) {
  const theme = useTheme();
  const decorativeCircle = {
    position: 'absolute',
    borderRadius: theme.radii.full,
    opacity: 0.7,
  } as const;

  return (
    <View
      style={{
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.xl,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radii.xl,
        backgroundColor: theme.colors.tintPeach,
        overflow: 'hidden',
      }}
    >
      <View
        style={[
          decorativeCircle,
          { top: -36, left: -36, width: 110, height: 110, backgroundColor: theme.colors.tintHoney },
        ]}
      />
      <View
        style={[
          decorativeCircle,
          {
            bottom: -28,
            right: -28,
            width: 90,
            height: 90,
            backgroundColor: theme.colors.tintSage,
          },
        ]}
      />

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row' }}
      >
        {STAT_CATEGORIES.map((category, index) => (
          <View
            key={category.slug}
            style={{
              width: 56,
              height: 56,
              marginLeft: index === 0 ? 0 : -theme.spacing.md,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radii.full,
              borderWidth: 3,
              borderColor: theme.colors.tintPeach,
              backgroundColor: theme.colors.surface,
            }}
          >
            <CategoryIllustration slug={category.slug} size={32} />
          </View>
        ))}
      </View>

      <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
        <AppText variant="section" accessibilityRole="header" style={{ textAlign: 'center' }}>
          Votre nid est encore vide.
        </AppText>
        <AppText variant="body" style={{ textAlign: 'center' }}>
          Ajoutez votre premier trésor.
        </AppText>
      </View>

      <Button
        label="Ajouter un objet"
        variant="secondary"
        onPress={onAdd}
        style={{ alignSelf: 'stretch' }}
      />
    </View>
  );
}

type RecentItemsQuery = ReturnType<typeof useItems>;

/**
 * Rendu indépendant des stats : leur lenteur ou leur panne ne masque jamais les
 * récents. Section retirée (pas de zone vide) si aucun item n'est retourné.
 */
function RecentItemsSection({
  query,
  onPressItem,
}: {
  query: RecentItemsQuery;
  onPressItem: (itemId: string) => void;
}) {
  const theme = useTheme();
  const items = query.data?.pages[0]?.data;

  let content: ReactNode;
  if (items) {
    if (items.length === 0) return null;
    content = (
      <RecentItemsCard>
        {items.map((item, index) => (
          <View
            key={item.id}
            style={
              index > 0 ? { borderTopWidth: 1, borderTopColor: theme.colors.border } : undefined
            }
          >
            <RecentItemRow item={item} onPress={() => onPressItem(item.id)} />
          </View>
        ))}
      </RecentItemsCard>
    );
  } else if (query.isLoading) {
    content = (
      <RecentItemsCard testID="home-recent-skeleton">
        {Array.from({ length: RECENT_SKELETON_ROWS }, (_, index) => (
          <View
            key={index}
            style={
              index > 0 ? { borderTopWidth: 1, borderTopColor: theme.colors.border } : undefined
            }
          >
            <RecentItemRowSkeleton />
          </View>
        ))}
      </RecentItemsCard>
    );
  } else if (query.isError) {
    content = (
      <ErrorState
        title="Impossible d’afficher les ajouts récents"
        message={getErrorMessage(query.error)}
        onRetry={() => void query.refetch()}
      />
    );
  } else {
    return null;
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="section" accessibilityRole="header">
        Ajouts récents
      </AppText>
      {content}
    </View>
  );
}

function RecentItemsCard({ children, testID }: { children: ReactNode; testID?: string }) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      style={[
        {
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.surface,
        },
        theme.elevation.low,
      ]}
    >
      {children}
    </View>
  );
}
