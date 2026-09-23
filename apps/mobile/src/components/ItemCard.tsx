import type { Item } from '@notre-nid/shared';
import { Pressable, View } from 'react-native';

import { CONDITION_INFO } from '../constants/condition';
import { secondaryInfoForItem } from '../lib/itemSecondaryInfo';
import { useTheme } from '../theme';

import { AppText } from './AppText';
import { CategoryBadge } from './CategoryBadge';
import { ConditionBadge } from './ConditionBadge';
import { ItemCover } from './ItemCover';
import { OwnerAvatarGroup } from './OwnerAvatarGroup';
import { formatRatingLabel, StarRating } from './StarRating';

export interface ItemCardProps {
  item: Item;
  onPress: () => void;
}

/**
 * Titre/catégorie/état/note/propriétaires sont déjà visibles sur la carte, mais
 * n'atteignent jamais un lecteur d'écran tels quels : `OwnerAvatarGroup` et
 * `StarRating` portent chacun leur propre `accessibilityLabel`, or ils sont
 * imbriqués dans ce `Pressable` — dont le label, une fois posé, « avale » tout
 * label descendant (VoiceOver/TalkBack n'annoncent alors que celui du parent).
 * Reste volontairement concis (pas d'ISBN/éditeur/date/notes personnelles ici :
 * ces informations ont leur place en fiche détail, jamais sur une carte de liste).
 */
export function itemCardAccessibilityLabel(item: Item): string {
  const segments = [item.title, item.category.name, CONDITION_INFO[item.condition].label];

  if (item.rating) segments.push(`note ${formatRatingLabel(item.rating)} sur 5`);

  if (item.owners.length === 1) {
    segments.push(`propriétaire ${item.owners[0]!.displayName}`);
  } else if (item.owners.length === 2) {
    segments.push(`propriétaires ${item.owners[0]!.displayName} et ${item.owners[1]!.displayName}`);
  } else if (item.owners.length > 2) {
    segments.push(`${item.owners.length} propriétaires`);
  }

  return segments.join(', ');
}

/** Carte compacte de la collection : couverture, titre, info secondaire, badges, propriétaires. */
export function ItemCard({ item, onPress }: ItemCardProps) {
  const theme = useTheme();
  const subtitle = secondaryInfoForItem(item);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={itemCardAccessibilityLabel(item)}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.85 : 1,
        },
        theme.elevation.low,
      ]}
    >
      <ItemCover
        uri={item.coverImageUrl}
        categorySlug={item.category.slug}
        illustrationSize={40}
        transition={150}
        style={{
          width: 56,
          height: 56,
          borderRadius: theme.radii.sm,
          backgroundColor: theme.colors.background,
        }}
      />

      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="section" numberOfLines={1}>
          {item.title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
        <View style={{ flexDirection: 'row', gap: theme.spacing.xs, marginTop: 4 }}>
          <CategoryBadge name={item.category.name} slug={item.category.slug} />
          <ConditionBadge condition={item.condition} />
        </View>
        {item.rating ? (
          <StarRating
            value={item.rating}
            readOnly
            size={theme.iconSizes.sm}
            accessibilityLabel={`Note : ${item.rating} sur 5`}
          />
        ) : null}
        <View style={{ marginTop: 4 }}>
          <OwnerAvatarGroup owners={item.owners} />
        </View>
      </View>
    </Pressable>
  );
}
