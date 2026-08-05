import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import {
  AppText,
  CategoryBadge,
  ConditionBadge,
  ErrorState,
  LoadingSkeleton,
  OwnerAvatarGroup,
  ScreenContainer,
} from '../../../components';
import { useItem } from '../../../hooks/useItem';
import { getErrorMessage } from '../../../lib/errorMessage';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { useTheme } from '../../../theme';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ItemDetailScreen() {
  const theme = useTheme();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { householdId } = useHousehold();
  const itemQuery = useItem(householdId, itemId);

  if (itemQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={{ gap: theme.spacing.md }}>
          <LoadingSkeleton height={220} radius={theme.radii.lg} />
          <LoadingSkeleton width="60%" height={24} />
          <LoadingSkeleton width="40%" height={16} />
        </View>
      </ScreenContainer>
    );
  }

  if (itemQuery.isError || !itemQuery.data) {
    return (
      <ScreenContainer>
        <ErrorState
          title="Objet introuvable"
          message={itemQuery.error ? getErrorMessage(itemQuery.error) : "Cet objet n'existe pas."}
          onRetry={() => void itemQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  const item = itemQuery.data;

  return (
    <ScreenContainer scroll>
      <Stack.Screen options={{ title: item.title }} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ gap: theme.spacing.lg }}>
          {item.coverImageUrl ? (
            <Image
              source={{ uri: item.coverImageUrl }}
              style={{
                width: '100%',
                aspectRatio: 3 / 4,
                borderRadius: theme.radii.lg,
                backgroundColor: theme.colors.surface,
              }}
              contentFit="cover"
            />
          ) : null}

          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="title">{item.title}</AppText>
            <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
              <CategoryBadge name={item.category.name} slug={item.category.slug} />
              <ConditionBadge condition={item.condition} />
            </View>
          </View>

          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="label" color="textMuted">
              Propriétaires
            </AppText>
            <OwnerAvatarGroup owners={item.owners} max={6} />
          </View>

          {item.description ? (
            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="label" color="textMuted">
                Description
              </AppText>
              <AppText variant="body">{item.description}</AppText>
            </View>
          ) : null}

          <MetadataSection item={item} />

          {item.notes ? (
            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="label" color="textMuted">
                Notes
              </AppText>
              <AppText variant="body">{item.notes}</AppText>
            </View>
          ) : null}

          <View style={{ gap: 4 }}>
            <AppText variant="caption" color="textMuted">
              Ajouté par {item.createdBy.displayName} le {formatDate(item.createdAt)}
            </AppText>
            {item.updatedAt !== item.createdAt ? (
              <AppText variant="caption" color="textMuted">
                Modifié par {item.updatedBy.displayName} le {formatDate(item.updatedAt)}
              </AppText>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function MetadataSection({ item }: { item: NonNullable<ReturnType<typeof useItem>['data']> }) {
  const theme = useTheme();
  const rows: [string, string][] = [];

  if (item.book) {
    if (item.book.author) rows.push(['Auteur', item.book.author]);
    if (item.book.publisher) rows.push(['Éditeur', item.book.publisher]);
    if (item.book.publicationYear) rows.push(['Année', String(item.book.publicationYear)]);
    if (item.book.isbn) rows.push(['ISBN', item.book.isbn]);
    if (item.book.language) rows.push(['Langue', item.book.language]);
    if (item.book.pageCount) rows.push(['Pages', String(item.book.pageCount)]);
  } else if (item.cd) {
    if (item.cd.artist) rows.push(['Artiste', item.cd.artist]);
    if (item.cd.album) rows.push(['Album', item.cd.album]);
    if (item.cd.releaseYear) rows.push(['Année', String(item.cd.releaseYear)]);
    if (item.cd.label) rows.push(['Label', item.cd.label]);
    if (item.cd.format) rows.push(['Format', item.cd.format]);
  } else if (item.dvd) {
    if (item.dvd.director) rows.push(['Réalisateur', item.dvd.director]);
    if (item.dvd.releaseYear) rows.push(['Année', String(item.dvd.releaseYear)]);
    if (item.dvd.edition) rows.push(['Édition', item.dvd.edition]);
    if (item.dvd.region) rows.push(['Région', item.dvd.region]);
    if (item.dvd.durationMinutes) rows.push(['Durée', `${item.dvd.durationMinutes} min`]);
  } else if (item.customMetadata) {
    for (const [key, value] of Object.entries(item.customMetadata)) {
      rows.push([key, String(value)]);
    }
  }

  if (rows.length === 0) return null;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText variant="label" color="textMuted">
        Détails
      </AppText>
      <View
        style={{
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.md,
          gap: theme.spacing.xs,
        }}
      >
        {rows.map(([label, value]) => (
          <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="body" color="textMuted">
              {label}
            </AppText>
            <AppText variant="body">{value}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
