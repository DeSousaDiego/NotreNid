import { SYSTEM_CATEGORY_SLUGS } from '@notre-nid/shared';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';

import { AppText, Button, ErrorState, LoadingSkeleton, ScreenContainer } from '../../components';
import { getCategoryIcon } from '../../constants/category-icons';
import { getErrorMessage } from '../../lib/errorMessage';
import { useAuth } from '../../providers/AuthProvider';
import { useHousehold } from '../../providers/HouseholdProvider';
import { useStats } from '../../hooks/useStats';
import { useTheme } from '../../theme';

export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { householdId } = useHousehold();
  const statsQuery = useStats(householdId);

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={statsQuery.isRefetching}
            onRefresh={() => void statsQuery.refetch()}
          />
        }
        contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xl }}
      >
        <View>
          <AppText variant="display" color="primary">
            Notre Nid
          </AppText>
          <AppText variant="body" color="textMuted">
            Bienvenue dans votre nid, {user?.displayName}.
          </AppText>
        </View>

        {statsQuery.isLoading ? (
          <View style={{ gap: theme.spacing.sm }}>
            <LoadingSkeleton height={80} />
            <LoadingSkeleton height={80} />
          </View>
        ) : statsQuery.isError ? (
          <ErrorState
            message={getErrorMessage(statsQuery.error)}
            onRetry={() => void statsQuery.refetch()}
          />
        ) : statsQuery.data ? (
          <>
            <CategoryStatsGrid stats={statsQuery.data} />

            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="section">Ajouts récents</AppText>
              {statsQuery.data.recentAdditions.length === 0 ? (
                <AppText variant="body" color="textMuted">
                  Votre nid est encore vide. Les prochains objets ajoutés apparaîtront ici.
                </AppText>
              ) : (
                statsQuery.data.recentAdditions.map((addition) => (
                  <AppText
                    key={addition.id}
                    variant="body"
                    color="primary"
                    onPress={() =>
                      router.push({
                        pathname: '/(app)/collection/[itemId]',
                        params: { itemId: addition.id },
                      })
                    }
                  >
                    {addition.title} · {addition.category}
                  </AppText>
                ))
              )}
            </View>
          </>
        ) : null}

        <Button
          label="Voir la collection"
          variant="secondary"
          onPress={() => router.push('/(app)/collection')}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

type Stats = NonNullable<ReturnType<typeof useStats>['data']>;

function countForSlug(stats: Stats, slug: string): number {
  return stats.countByCategory.find((c) => c.categorySlug === slug)?.count ?? 0;
}

/** Grille compacte 2×2 : Livres / CD / DVD / Total (docs/NOTRE_NID_PRD.md section 4.11, mockup). */
function CategoryStatsGrid({ stats }: { stats: Stats }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <StatTile
          icon={getCategoryIcon(SYSTEM_CATEGORY_SLUGS.BOOK)}
          label="Livres"
          value={countForSlug(stats, SYSTEM_CATEGORY_SLUGS.BOOK)}
        />
        <StatTile
          icon={getCategoryIcon(SYSTEM_CATEGORY_SLUGS.CD)}
          label="CD"
          value={countForSlug(stats, SYSTEM_CATEGORY_SLUGS.CD)}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <StatTile
          icon={getCategoryIcon(SYSTEM_CATEGORY_SLUGS.DVD)}
          label="DVD"
          value={countForSlug(stats, SYSTEM_CATEGORY_SLUGS.DVD)}
        />
        <StatTile icon="layers-outline" label="Total" value={stats.totalActiveItems} accent />
      </View>
    </View>
  );
}

function StatTile({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  accent?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        padding: theme.spacing.sm,
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: theme.radii.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <Ionicons
          name={icon}
          size={theme.iconSizes.md}
          color={accent ? theme.colors.secondary : theme.colors.primary}
        />
      </View>
      <View>
        <AppText variant="title" color="primary">
          {value}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {label}
        </AppText>
      </View>
    </View>
  );
}
