import { Ionicons } from '@expo/vector-icons';
import { getCountryName, type Item } from '@notre-nid/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import {
  AppText,
  Button,
  ConfirmDialog,
  ErrorState,
  FloatingActionButton,
  FLOATING_ACTION_BUTTON_SIZE,
  ItemCover,
  LoadingSkeleton,
  NavigationRow,
  OwnerAvatarGroup,
  RowGroup,
  ScreenContainer,
  StarRating,
  useToast,
} from '../../../components';
import { getCategoryTint } from '../../../constants/category-icons';
import { CONDITION_INFO } from '../../../constants/condition';
import { useArchiveItem, useRestoreItem } from '../../../hooks/useItemMutations';
import { useItem } from '../../../hooks/useItem';
import { getErrorMessage, isNotFoundError } from '../../../lib/errorMessage';
import { creditLineForItem, ownersPhrase } from '../../../lib/itemSecondaryInfo';
import { useHousehold } from '../../../providers/HouseholdProvider';
import {
  BOOK_FIELDS,
  CD_FIELDS,
  countryLabelForSlug,
  customMetadataDisplayRows,
  DVD_FIELDS,
  metadataDisplayRows,
  type MetadataDisplayRow,
  type MetadataFieldConfig,
} from '../../../screens/item-form/metadataFields';
import { useTheme, type ColorToken } from '../../../theme';

const COVER_WIDTH_RATIO = 0.6;
const COVER_ASPECT_RATIO = 3 / 4;

/** Déjà affichés sous le titre (« créateur · année ») : jamais répétés plus bas. */
const CREDIT_LINE_KEYS = new Set<MetadataFieldConfig['key']>([
  'author',
  'artist',
  'director',
  'publicationYear',
  'releaseYear',
]);

/** Identifiants machine, regroupés à part et plus discrets que le reste. */
const IDENTIFIER_KEYS = new Set<MetadataFieldConfig['key']>(['isbn', 'region']);

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** « Édition » parle pour un livre ou un DVD, moins pour un album ou un objet libre. */
function aboutSectionTitle(slug: string): string {
  if (slug === 'cd') return 'À propos de cet album';
  if (slug === 'book' || slug === 'dvd') return 'À propos de cette édition';
  return 'À propos de cet objet';
}

/** Teinte de catégorie (comme l'Accueil) ; lin pour une catégorie personnalisée,
 * qui n'en a pas — jamais le `surface` quasi invisible sur le fond crème. */
function coverBackground(slug: string): ColorToken {
  const tint = getCategoryTint(slug);
  return tint === 'surface' ? 'tintLinen' : tint;
}

export default function ItemDetailScreen() {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { showToast } = useToast();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { householdId } = useHousehold();
  const itemQuery = useItem(householdId, itemId);
  const archiveItem = useArchiveItem(householdId);
  const restoreItem = useRestoreItem(householdId);
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
    // Mêmes proportions que la vraie couverture (60 % de la largeur utile, 3:4) :
    // pas de saut de mise en page à l'arrivée des données.
    const coverWidth = (windowWidth - theme.spacing.lg * 2) * COVER_WIDTH_RATIO;
    return (
      <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
        <View testID="item-detail-skeleton" style={{ gap: theme.spacing.md }}>
          <View style={{ alignItems: 'center', marginBottom: theme.spacing.sm }}>
            <LoadingSkeleton
              width={coverWidth}
              height={coverWidth / COVER_ASPECT_RATIO}
              radius={theme.radii.lg}
            />
          </View>
          <LoadingSkeleton width="60%" height={theme.typography.title.lineHeight} />
          <LoadingSkeleton width="40%" height={16} />
        </View>
      </ScreenContainer>
    );
  }

  // Données d'abord : un refetch en échec (TanStack Query v5 conserve `data`) ne
  // remplace jamais une fiche déjà affichée par un écran d'erreur. Sans donnée,
  // seul un vrai 404 de l'API signifie « introuvable » : une panne réseau ou
  // serveur garde le message générique et « Réessayer ».
  if (!itemQuery.data) {
    const notFound = !itemQuery.error || isNotFoundError(itemQuery.error);
    return (
      <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
        {notFound ? (
          <ErrorState
            title="Objet introuvable"
            message="Cet objet n’existe pas ou n’est plus accessible depuis ce foyer."
          />
        ) : (
          <ErrorState
            message={getErrorMessage(itemQuery.error)}
            onRetry={() => void itemQuery.refetch()}
          />
        )}
      </ScreenContainer>
    );
  }

  const item = itemQuery.data;
  const isArchived = Boolean(item.archivedAt);
  const creditLine = creditLineForItem(item);
  const { about, identifiers } = metadataSections(item);
  const hasCountries = (item.countryCodes ?? []).length > 0;

  return (
    // Le titre n'est porté que par le corps de l'écran (header natif sans titre,
    // voir `(app)/_layout.tsx`) : un seul titre lisible, lu une seule fois.
    <View style={{ flex: 1 }}>
      <ScreenContainer
        scroll
        edges={['top', 'left', 'right', 'bottom']}
        // La zone de sécurité basse est déjà réservée par `ScreenContainer` : seul
        // le FAB Modifier (au-dessus de cette zone) doit encore être dégagé.
        contentStyle={{
          paddingBottom: isArchived
            ? theme.spacing.xl
            : FLOATING_ACTION_BUTTON_SIZE + theme.spacing.xl + theme.spacing.md,
        }}
      >
        <View style={{ gap: theme.spacing.xl }}>
          {isArchived ? (
            <ArchivedBanner
              restoring={restoreItem.isPending}
              onRestore={() => void handleRestore()}
            />
          ) : null}

          <View style={{ alignItems: 'center' }}>
            <ItemCover
              uri={item.coverImageUrl}
              categorySlug={item.category.slug}
              illustrationSize={96}
              style={{
                width: `${COVER_WIDTH_RATIO * 100}%`,
                aspectRatio: COVER_ASPECT_RATIO,
                borderRadius: theme.radii.lg,
                backgroundColor: theme.colors[coverBackground(item.category.slug)],
              }}
            />
          </View>

          <View style={{ gap: theme.spacing.md }}>
            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="label" color="textMuted">
                {item.category.name}
              </AppText>
              <AppText variant="title" accessibilityRole="header">
                {item.title}
              </AppText>
              {creditLine ? (
                <AppText variant="body" color="text">
                  {creditLine}
                </AppText>
              ) : null}
            </View>
            <OwnersAndRating item={item} />
          </View>

          {item.notes ? <PersonalNotes notes={item.notes} /> : null}

          {item.description ? (
            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="label" color="textMuted" accessibilityRole="header">
                Description
              </AppText>
              <AppText variant="body">{item.description}</AppText>
            </View>
          ) : null}

          <RowGroup title={aboutSectionTitle(item.category.slug)}>
            {about.map((row) => (
              <MetadataRow key={row.label} label={row.label} value={row.value} />
            ))}
            {hasCountries ? (
              <CountriesRow
                key="countries"
                label={countryLabelForSlug(item.category.slug)}
                countryCodes={item.countryCodes}
              />
            ) : null}
            <MetadataRow
              key="condition"
              label="État"
              value={CONDITION_INFO[item.condition].label}
            />
          </RowGroup>

          {identifiers.length > 0 ? (
            <RowGroup title="Identifiants" tone="subtle">
              {identifiers.map((row) => (
                <MetadataRow key={row.label} label={row.label} value={row.value} muted />
              ))}
            </RowGroup>
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

          {isArchived ? null : (
            <RowGroup tone="subtle">
              <NavigationRow
                icon="archive-outline"
                label="Archiver cet objet"
                description="Vous pourrez le restaurer à tout moment."
                accessibilityHint="Vous pourrez le restaurer à tout moment depuis les archives."
                tone="muted"
                showChevron={false}
                onPress={() => setConfirmArchiveVisible(true)}
              />
            </RowGroup>
          )}
        </View>
      </ScreenContainer>

      {isArchived ? null : (
        <FloatingActionButton
          icon="pencil"
          accessibilityLabel="Modifier cet objet"
          onPress={() =>
            router.push({
              pathname: '/(app)/collection/edit/[itemId]',
              params: { itemId: item.id },
            })
          }
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

/**
 * Répartit les métadonnées entre « À propos… » (ce qui décrit l'édition/l'objet)
 * et « Identifiants » (ISBN, région, code-barres). Créateur et année n'y figurent
 * pas : ils sont déjà sous le titre. Ordre et libellés restent ceux de
 * `metadataFields.ts` (même source que le formulaire). Les `customMetadata` d'une
 * catégorie personnalisée sont du contenu saisi par le foyer : « À propos ».
 */
function metadataSections(item: Item): {
  about: MetadataDisplayRow[];
  identifiers: MetadataDisplayRow[];
} {
  const native = item.book
    ? { fields: BOOK_FIELDS, values: item.book }
    : item.cd
      ? { fields: CD_FIELDS, values: item.cd }
      : item.dvd
        ? { fields: DVD_FIELDS, values: item.dvd }
        : null;

  let about: MetadataDisplayRow[] = [];
  let identifiers: MetadataDisplayRow[] = [];

  if (native) {
    const visible = native.fields.filter((field) => !CREDIT_LINE_KEYS.has(field.key));
    about = metadataDisplayRows(
      visible.filter((field) => !IDENTIFIER_KEYS.has(field.key)),
      native.values,
    );
    identifiers = metadataDisplayRows(
      visible.filter((field) => IDENTIFIER_KEYS.has(field.key)),
      native.values,
    );
  } else if (item.customMetadata) {
    about = customMetadataDisplayRows(item.customMetadata, item.category.metadataSchema);
  }

  if (item.barcode) {
    identifiers = [...identifiers, { label: 'Code-barres', value: item.barcode }];
  }

  return { about, identifiers };
}

function ArchivedBanner({ restoring, onRestore }: { restoring: boolean; onRestore: () => void }) {
  const theme = useTheme();

  return (
    <View
      testID="archived-banner"
      style={{
        gap: theme.spacing.md,
        padding: theme.spacing.lg,
        borderRadius: theme.radii.lg,
        backgroundColor: theme.colors.tintLinen,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Ionicons
          name="archive-outline"
          size={theme.iconSizes.md}
          color={theme.colors.primary}
          accessible={false}
          importantForAccessibility="no"
        />
        <AppText variant="label" color="text" style={{ flex: 1 }}>
          Cet objet est rangé dans les archives.
        </AppText>
      </View>
      <Button label="Remettre dans la collection" onPress={onRestore} loading={restoring} />
    </View>
  );
}

/** Note compacte et propriétaires en toutes lettres, sur une même zone qui passe à
 * la ligne si la place manque (texte agrandi). Les avatars sont décoratifs ici :
 * la phrase « À Julie et Diego » porte l'information pour tout le monde. */
function OwnersAndRating({ item }: { item: Item }) {
  const theme = useTheme();
  const phrase = ownersPhrase(item.owners);

  if (!phrase && !item.rating) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        columnGap: theme.spacing.md,
        rowGap: theme.spacing.sm,
      }}
    >
      {phrase ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flexShrink: 1,
          }}
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <OwnerAvatarGroup owners={item.owners} max={3} ringColor="background" />
          </View>
          <AppText variant="label" color="primary" style={{ flexShrink: 1 }}>
            {phrase}
          </AppText>
        </View>
      ) : null}
      {item.rating ? (
        <StarRating
          value={item.rating}
          readOnly
          size={theme.iconSizes.md}
          accessibilityLabel={`Note : ${item.rating} sur 5`}
        />
      ) : null}
    </View>
  );
}

/** Notes personnelles : petite surface sauge, comme les cartes de l'Accueil et du
 * Profil — un mot du foyer, pas un champ de base de données. */
function PersonalNotes({ notes }: { notes: string }) {
  const theme = useTheme();

  return (
    <View
      testID="personal-notes"
      style={{
        gap: theme.spacing.xs,
        padding: theme.spacing.lg,
        borderRadius: theme.radii.lg,
        backgroundColor: theme.colors.tintSage,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
        <Ionicons
          name="heart-outline"
          size={theme.iconSizes.sm}
          color={theme.colors.secondary}
          accessible={false}
          importantForAccessibility="no"
        />
        <AppText variant="label" color="primary" accessibilityRole="header">
          Vos notes
        </AppText>
      </View>
      <AppText variant="body">{notes}</AppText>
    </View>
  );
}

/**
 * Ligne « label / valeur » d'un `RowGroup`. `flexShrink` vaut 0 par défaut en React
 * Native : sans ces contraintes, une valeur longue (édition, éditeur, texte agrandi)
 * sortait de l'écran au lieu de passer à la ligne. Le label garde au plus 40 % de
 * la largeur, la valeur occupe le reste, toujours alignée à droite.
 */
function MetadataRow({ label, value, muted = false }: MetadataDisplayRow & { muted?: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <AppText variant="body" color="textMuted" style={{ flexShrink: 1, maxWidth: '40%' }}>
        {label}
      </AppText>
      <AppText
        variant="body"
        color={muted ? 'textMuted' : 'text'}
        style={{ flex: 1, textAlign: 'right' }}
      >
        {value}
      </AppText>
    </View>
  );
}

/**
 * Bloc « pays » : label au-dessus, pastilles en dessous sur toute la largeur — jamais
 * la mise en page label/valeur à une seule ligne, qui tronquait la liste dès que
 * plusieurs pays étaient présents.
 */
function CountriesRow({ label, countryCodes }: { label: string; countryCodes: string[] }) {
  const theme = useTheme();
  const names = countryCodes.map((code) => getCountryName(code) ?? code);

  return (
    <View style={{ gap: theme.spacing.xs, paddingVertical: theme.spacing.sm }}>
      <AppText variant="body" color="textMuted">
        {label}
      </AppText>
      <View
        accessibilityLabel={`${label} : ${names.join(', ')}`}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}
      >
        {names.map((name, index) => (
          <CountryChip key={`${countryCodes[index]}-${name}`} label={name} />
        ))}
      </View>
    </View>
  );
}

function CountryChip({ label }: { label: string }) {
  const theme = useTheme();

  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: theme.radii.sm,
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <AppText variant="caption" color="text">
        {label}
      </AppText>
    </View>
  );
}
