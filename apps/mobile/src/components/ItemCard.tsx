import { Ionicons } from '@expo/vector-icons';
import type { Item } from '@notre-nid/shared';
import { Pressable, View } from 'react-native';

import { getCategoryCoverTint } from '../constants/category-icons';
import { creditLineForItem, ownersPhrase } from '../lib/itemSecondaryInfo';
import { useTheme } from '../theme';

import { AppText } from './AppText';
import { ItemCover } from './ItemCover';
import { OwnerAvatarGroup } from './OwnerAvatarGroup';
import { formatRatingLabel } from './StarRating';

export interface ItemCardProps {
  item: Item;
  onPress: () => void;
}

/** Miniature portrait (livre, film), comme `RecentItemRow` ; carrée pour un CD, dans
 * la même largeur pour que la colonne de texte reste alignée d'une carte à l'autre. */
export const ITEM_CARD_COVER_WIDTH = 48;
const COVER_PORTRAIT_HEIGHT = 64;
const OWNER_AVATAR_SIZE = 20;

function coverHeightForSlug(slug: string): number {
  return slug === 'cd' ? ITEM_CARD_COVER_WIDTH : COVER_PORTRAIT_HEIGHT;
}

/**
 * Le `Pressable` « avale » tout label descendant (VoiceOver/TalkBack n'annoncent
 * que le sien) : tout ce que la carte montre doit donc y figurer — titre,
 * créateur · année, note, propriétaires — plus la catégorie, que la carte ne
 * montre qu'à travers la couverture. Reste volontairement concis (ni état, ni
 * ISBN, ni notes : leur place est la fiche détail).
 */
export function itemCardAccessibilityLabel(item: Item): string {
  const segments = [item.title];

  const credit = creditLineForItem(item);
  if (credit) segments.push(credit.replace(' · ', ', '));
  segments.push(item.category.name);
  if (item.rating) segments.push(`note ${formatRatingLabel(item.rating)} sur 5`);

  const owners = ownersPhrase(item.owners);
  if (owners) segments.push(`appartient ${owners.charAt(0).toLowerCase()}${owners.slice(1)}`);

  return segments.join(', ');
}

/**
 * Carte de la Collection et des Archives, dans la famille de `RecentItemRow`
 * (Accueil) : couverture sur la teinte de sa catégorie, titre sur deux lignes au
 * plus, « créateur · année », puis une ligne basse « À Julie et Diego » + note.
 * Ni badge de catégorie (la couverture la porte déjà) ni badge d'état (fiche
 * détail et filtres) : un objet du nid, pas une fiche de catalogue.
 */
export function ItemCard({ item, onPress }: ItemCardProps) {
  const theme = useTheme();
  const credit = creditLineForItem(item);
  const owners = ownersPhrase(item.owners, { maxNamed: 2 });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={itemCardAccessibilityLabel(item)}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.surface,
          opacity: pressed ? 0.85 : 1,
        },
        // Une seule profondeur, comme la carte « Ajouts récents » de l'Accueil :
        // ombre légère, plus de bordure en plus.
        theme.elevation.low,
      ]}
    >
      <View style={{ width: ITEM_CARD_COVER_WIDTH, alignItems: 'center' }}>
        <ItemCover
          uri={item.coverImageUrl}
          categorySlug={item.category.slug}
          illustrationSize={32}
          transition={150}
          style={{
            width: ITEM_CARD_COVER_WIDTH,
            height: coverHeightForSlug(item.category.slug),
            borderRadius: theme.radii.sm,
            backgroundColor: theme.colors[getCategoryCoverTint(item.category.slug)],
          }}
        />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="section" numberOfLines={2}>
          {item.title}
        </AppText>
        {credit ? (
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {credit}
          </AppText>
        ) : null}
        {owners || item.rating ? (
          <View
            testID="item-card-footer"
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: theme.spacing.md,
              rowGap: 2,
              marginTop: theme.spacing.xs,
            }}
          >
            {owners ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.xs,
                  flexShrink: 1,
                }}
              >
                <OwnerAvatarGroup owners={item.owners} max={2} size={OWNER_AVATAR_SIZE} />
                <AppText
                  variant="caption"
                  color="primary"
                  numberOfLines={1}
                  style={{ flexShrink: 1 }}
                >
                  {owners}
                </AppText>
              </View>
            ) : null}
            {item.rating ? (
              <View
                testID="item-card-rating"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
              >
                <Ionicons name="star" size={theme.iconSizes.sm} color={theme.colors.accent} />
                <AppText variant="caption" color="text">
                  {formatRatingLabel(item.rating)}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
