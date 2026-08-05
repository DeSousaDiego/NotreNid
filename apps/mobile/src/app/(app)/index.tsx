import { router } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';

import {
  AppText,
  Button,
  ErrorState,
  LoadingSkeleton,
  ScreenContainer,
} from '../../components';
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
          <RefreshControl refreshing={statsQuery.isRefetching} onRefresh={() => void statsQuery.refetch()} />
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
            <View
              style={{
                flexDirection: 'row',
                gap: theme.spacing.sm,
              }}
            >
              <StatTile
                label="Objets actifs"
                value={statsQuery.data.totalActiveItems}
              />
              <StatTile label="Archivés" value={statsQuery.data.archivedCount} />
            </View>

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

function StatTile({ label, value }: { label: string; value: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        padding: theme.spacing.lg,
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: 4,
      }}
    >
      <AppText variant="title" color="primary">
        {value}
      </AppText>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
    </View>
  );
}
