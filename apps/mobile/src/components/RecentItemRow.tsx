import type { Item } from '@notre-nid/shared';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { secondaryInfoForItem } from '../lib/itemSecondaryInfo';
import { formatRelativeDate } from '../lib/relativeDate';
import { useTheme } from '../theme';

import { AppText } from './AppText';
import { CategoryBadge } from './CategoryBadge';
import { CategoryIllustration } from './CategoryIllustration';

export interface RecentItemRowProps {
  item: Item;
  onPress: () => void;
}

/**
 * Carte "Ajouts récents" de l'accueil (mock-up Notre Nid) : plus légère que `ItemCard`
 * (pas de badge d'état, pas de note, pas de groupe de propriétaires) — petite
 * couverture, titre, auteur/artiste/réalisateur, catégorie, "Ajouté par… · date".
 */
export function RecentItemRow({ item, onPress }: RecentItemRowProps) {
  const theme = useTheme();
  const subtitle = secondaryInfoForItem(item);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.category.name}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 48,
          height: 64,
          borderRadius: theme.radii.sm,
          backgroundColor: theme.colors.surface,
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
          <CategoryIllustration slug={item.category.slug} size={32} />
        )}
      </View>

      <View style={{ flex: 1, gap: 2, justifyContent: 'center' }}>
        <AppText variant="section" numberOfLines={1}>
          {item.title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
        <View style={{ marginTop: 2 }}>
          <CategoryBadge name={item.category.name} slug={item.category.slug} />
        </View>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          Ajouté par {item.createdBy.displayName} · {formatRelativeDate(item.createdAt)}
        </AppText>
      </View>
    </Pressable>
  );
}
