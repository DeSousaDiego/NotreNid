import type { Item } from '@notre-nid/shared';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { secondaryInfoForItem } from '../lib/itemSecondaryInfo';
import { useTheme } from '../theme';

import { AppText } from './AppText';
import { CategoryBadge } from './CategoryBadge';
import { CategoryIllustration } from './CategoryIllustration';
import { ConditionBadge } from './ConditionBadge';
import { OwnerAvatarGroup } from './OwnerAvatarGroup';
import { StarRating } from './StarRating';

export interface ItemCardProps {
  item: Item;
  onPress: () => void;
}

/** Carte compacte de la collection : couverture, titre, info secondaire, badges, propriétaires. */
export function ItemCard({ item, onPress }: ItemCardProps) {
  const theme = useTheme();
  const subtitle = secondaryInfoForItem(item);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.category.name}`}
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
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: theme.radii.sm,
          backgroundColor: theme.colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {item.coverImageUrl ? (
          <Image
            source={{ uri: item.coverImageUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <CategoryIllustration slug={item.category.slug} size={40} />
        )}
      </View>

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
