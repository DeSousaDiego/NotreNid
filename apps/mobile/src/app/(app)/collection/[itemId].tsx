import { getCountryName } from '@notre-nid/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  ConditionBadge,
  ConfirmDialog,
  ErrorState,
  FloatingActionButton,
  FLOATING_ACTION_BUTTON_SIZE,
  ItemCover,
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
import {
  BOOK_FIELDS,
  CD_FIELDS,
  countryLabelForSlug,
  DVD_FIELDS,
  metadataDisplayRows,
  type MetadataDisplayRow,
} from '../../../screens/item-form/metadataFields';
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
              <ItemCover
                uri={item.coverImageUrl}
                categorySlug={item.category.slug}
                illustrationSize={96}
                style={{
                  width: `${COVER_WIDTH_RATIO * 100}%`,
                  aspectRatio: 3 / 4,
                  borderRadius: theme.radii.lg,
                  backgroundColor: theme.colors.surface,
                }}
              />
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

/**
 * Champs/ordre/libellés délégués à `metadataFields.ts` — même source de vérité
 * que le formulaire (`BOOK_FIELDS`/`CD_FIELDS`/`DVD_FIELDS`), plus aucune liste
 * dupliquée ici. Catégories personnalisées (`customMetadata`) : inchangé,
 * volontairement hors de cette source commune (clés arbitraires, pas de config
 * de champs à partager avec un formulaire). Code-barres : ajouté en dernier,
 * jamais comme métadonnée principale (générique à toutes les catégories, jamais
 * synchronisé avec `book.isbn`, voir docs/DECISIONS.md).
 */
function MetadataSection({ item }: { item: NonNullable<ReturnType<typeof useItem>['data']> }) {
  const theme = useTheme();
  let rows: MetadataDisplayRow[] = [];

  if (item.book) {
    rows = metadataDisplayRows(BOOK_FIELDS, item.book);
  } else if (item.cd) {
    rows = metadataDisplayRows(CD_FIELDS, item.cd);
  } else if (item.dvd) {
    rows = metadataDisplayRows(DVD_FIELDS, item.dvd);
  } else if (item.customMetadata) {
    rows = Object.entries(item.customMetadata).map(([key, value]) => ({
      label: key,
      value: String(value),
    }));
  }

  if (item.barcode) {
    rows = [...rows, { label: 'Code-barres', value: item.barcode }];
  }

  if (rows.length === 0) return null;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText variant="label" color="textMuted">
        Détails
      </AppText>
      <View>
        {rows.map((row, index) => (
          <View
            key={row.label}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: theme.spacing.xs,
              borderBottomWidth: index === rows.length - 1 ? 0 : 1,
              borderBottomColor: theme.colors.border,
            }}
          >
            <AppText variant="body" color="textMuted">
              {row.label}
            </AppText>
            <AppText variant="body">{row.value}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
