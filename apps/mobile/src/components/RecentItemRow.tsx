import type { Item } from '@notre-nid/shared';
import { Pressable, View } from 'react-native';

import { getCategoryTint } from '../constants/category-icons';
import { secondaryInfoForItem } from '../lib/itemSecondaryInfo';
import { formatRelativeDate } from '../lib/relativeDate';
import { useTheme } from '../theme';

import { AppText } from './AppText';
import { CategoryBadge } from './CategoryBadge';
import { ItemCover } from './ItemCover';
import { LoadingSkeleton } from './LoadingSkeleton';

export interface RecentItemRowProps {
  item: Item;
  onPress: () => void;
}

const COVER_WIDTH = 48;
const COVER_HEIGHT = 64;

/**
 * Label concis : le `Pressable` avale les labels descendants, donc tout ce qui est
 * visible (titre, catégorie, auteur, « Ajouté par… · date ») doit y figurer.
 */
export function recentItemAccessibilityLabel(item: Item, now?: Date): string {
  const segments = [item.title, item.category.name];
  const subtitle = secondaryInfoForItem(item);
  if (subtitle) segments.push(subtitle);
  segments.push(
    `ajouté par ${item.createdBy.displayName}`,
    formatRelativeDate(item.createdAt, now).toLowerCase(),
  );
  return segments.join(', ');
}

/**
 * Carte "Ajouts récents" de l'accueil (mock-up Notre Nid) : plus légère que `ItemCard`
 * (pas de badge d'état, pas de note, pas de groupe de propriétaires) — petite
 * couverture, titre, auteur/artiste/réalisateur, catégorie, "Ajouté par… · date".
 */
export function RecentItemRow({ item, onPress }: RecentItemRowProps) {
  const theme = useTheme();
  const subtitle = secondaryInfoForItem(item);
  // Sans couverture, le repli affiche déjà l'illustration de la catégorie : le badge
  // la répéterait à l'identique juste à côté. (Une URL présente mais cassée garde le
  // badge — cas rare, pas de remontée d'état depuis `ItemCover` pour si peu.)
  const showCategoryBadge = Boolean(item.coverImageUrl);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={recentItemAccessibilityLabel(item)}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <ItemCover
        uri={item.coverImageUrl}
        categorySlug={item.category.slug}
        illustrationSize={32}
        transition={150}
        style={{
          width: COVER_WIDTH,
          height: COVER_HEIGHT,
          borderRadius: theme.radii.sm,
          backgroundColor: theme.colors[getCategoryTint(item.category.slug)],
        }}
      />

      <View style={{ flex: 1, gap: 2, justifyContent: 'center' }}>
        <AppText variant="section" numberOfLines={1}>
          {item.title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
        {showCategoryBadge ? (
          <View style={{ marginTop: 2 }}>
            <CategoryBadge name={item.category.name} slug={item.category.slug} />
          </View>
        ) : null}
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          Ajouté par {item.createdBy.displayName} · {formatRelativeDate(item.createdAt)}
        </AppText>
      </View>
    </Pressable>
  );
}

/** Squelette de `RecentItemRow` : même couverture et mêmes lignes, sans carte. */
export function RecentItemRowSkeleton() {
  const theme = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', gap: theme.spacing.md, paddingVertical: theme.spacing.md }}
    >
      <LoadingSkeleton width={COVER_WIDTH} height={COVER_HEIGHT} radius={theme.radii.sm} />
      <View style={{ flex: 1, gap: 6, justifyContent: 'center' }}>
        <LoadingSkeleton width="65%" height={18} />
        <LoadingSkeleton width="40%" height={12} />
        <LoadingSkeleton width="55%" height={12} />
      </View>
    </View>
  );
}
