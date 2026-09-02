import { getCountryName } from '@notre-nid/shared';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  CategoryIllustration,
  ConditionBadge,
  ConfirmDialog,
  ErrorState,
  FloatingActionButton,
  FLOATING_ACTION_BUTTON_SIZE,
  LoadingSkeleton,
  OwnerAvatarGroup,
  ScreenContainer,
  StarRating,
  useToast,
} from '../../../components';
import { useArchiveItem, useRestoreItem } from '../../../hooks/useItemMutations';
import { useItem } from '../../../hooks/useItem';
import { getErrorMessage } from '../../../lib/errorMessage';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { countryLabelForSlug } from '../../../screens/item-form/metadataFields';
import { useTheme } from '../../../theme';

const COVER_WIDTH_RATIO = 0.6;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ItemDetailScreen() {
  const theme = useTheme();
  const { showToast } = useToast();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { householdId } = useHousehold();
  const itemQuery = useItem(householdId, itemId);
  const archiveItem = useArchiveItem(householdId);
  const restoreItem = useRestoreItem(householdId);
  const insets = useSafeAreaInsets();
  const [confirmArchiveVisible, setConfirmArchiveVisible] = useState(false);

  const handleArchive = async () => {
    try {
      await archiveItem.mutateAsync(itemId);
      setConfirmArchiveVisible(false);
      showToast('Objet archivé. Vous pouvez le restaurer depuis les archives.', 'success');
    } catch (error) {
      setConfirmArchiveVisible(false);
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleRestore = async () => {
    try {
      await restoreItem.mutateAsync(itemId);
      showToast('Objet restauré dans votre collection.', 'success');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  if (itemQuery.isLoading) {
    return (
      <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
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
      <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
        <ErrorState
          title="Objet introuvable"
          message={itemQuery.error ? getErrorMessage(itemQuery.error) : "Cet objet n'existe pas."}
          onRetry={() => void itemQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  const item = itemQuery.data;
  const canEdit = !item.archivedAt;
  const hasCountries = (item.countryCodes ?? []).length > 0;

  return (
    <View style={{ flex: 1 }}>
      <ScreenContainer scroll edges={['top', 'left', 'right', 'bottom']}>
        <Stack.Screen options={{ title: item.title }} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            // Sous les 1 ou 2 FAB empilés (Bloc 4) + la zone de sécurité basse de
            // l'appareil, jamais une valeur fixe seule — la navigation système
            // (barre de gestes Android, notamment) varie selon l'appareil.
            paddingBottom:
              insets.bottom + FLOATING_ACTION_BUTTON_SIZE * 2 + theme.spacing.xl + theme.spacing.md,
          }}
        >
          <View style={{ gap: theme.spacing.xl }}>
            <View style={{ alignItems: 'center' }}>
              {item.coverImageUrl ? (
                <Image
                  source={{ uri: item.coverImageUrl }}
                  style={{
                    width: `${COVER_WIDTH_RATIO * 100}%`,
                    aspectRatio: 3 / 4,
                    borderRadius: theme.radii.lg,
                    backgroundColor: theme.colors.surface,
                  }}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={{
                    width: `${COVER_WIDTH_RATIO * 100}%`,
                    aspectRatio: 3 / 4,
                    borderRadius: theme.radii.lg,
                    backgroundColor: theme.colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CategoryIllustration slug={item.category.slug} size={96} />
                </View>
              )}
            </View>

            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="label" color="textMuted">
                {item.category.name}
              </AppText>
              <AppText variant="title">{item.title}</AppText>
              {item.rating ? (
                <StarRating
                  value={item.rating}
                  readOnly
                  accessibilityLabel={`Note : ${item.rating} sur 5`}
                />
              ) : null}
            </View>

            <View>
              <InfoRow label="État">
                <ConditionBadge condition={item.condition} />
              </InfoRow>
              <InfoRow label="Propriétaires" last={!hasCountries}>
                <OwnerAvatarGroup owners={item.owners} max={6} />
              </InfoRow>
              {hasCountries ? (
                <InfoRow label={countryLabelForSlug(item.category.slug)} last>
                  <AppText variant="body">
                    {item.countryCodes.map((code) => getCountryName(code) ?? code).join(', ')}
                  </AppText>
                </InfoRow>
              ) : null}
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

            {item.archivedAt ? (
              <AppText variant="helper" color="textMuted">
                Cet objet est archivé. Utilisez le bouton en bas de l’écran pour le restaurer.
              </AppText>
            ) : null}
          </View>
        </ScrollView>
      </ScreenContainer>

      {canEdit ? (
        <>
          <FloatingActionButton
            icon="pencil"
            accessibilityLabel="Modifier cet item"
            onPress={() =>
              router.push({
                pathname: '/(app)/collection/edit/[itemId]',
                params: { itemId: item.id },
              })
            }
          />
          <FloatingActionButton
            icon="archive-outline"
            tone="primary"
            accessibilityLabel="Archiver cet item"
            stackOffset={FLOATING_ACTION_BUTTON_SIZE + theme.spacing.md}
            onPress={() => setConfirmArchiveVisible(true)}
          />
        </>
      ) : (
        <FloatingActionButton
          icon="refresh"
          tone="primary"
          accessibilityLabel="Restaurer cet item"
          onPress={() => void handleRestore()}
          disabled={restoreItem.isPending}
        />
      )}

      <ConfirmDialog
        visible={confirmArchiveVisible}
        title="Archiver cet objet ?"
        message="Vous pourrez le restaurer à tout moment depuis les archives."
        confirmLabel="Archiver"
        destructive
        loading={archiveItem.isPending}
        onConfirm={() => void handleArchive()}
        onCancel={() => setConfirmArchiveVisible(false)}
      />
    </View>
  );
}

/** Ligne "label / valeur" à séparateur fin — bloc "Informations" léger du mock-up
 * (pas de card à fond/bordure systématique, voir docs/PHASE_STATUS.md Bloc 4). */
function InfoRow({
  label,
  children,
  last = false,
}: {
  label: string;
  children: ReactNode;
  last?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <AppText variant="label" color="textMuted">
        {label}
      </AppText>
      {children}
    </View>
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
      <View>
        {rows.map(([label, value], index) => (
          <View
            key={label}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: theme.spacing.xs,
              borderBottomWidth: index === rows.length - 1 ? 0 : 1,
              borderBottomColor: theme.colors.border,
            }}
          >
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
