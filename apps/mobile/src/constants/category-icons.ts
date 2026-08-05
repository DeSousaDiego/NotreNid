import { SYSTEM_CATEGORY_SLUGS } from '@notre-nid/shared';
import type { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

const ICONS_BY_SLUG: Record<string, IconName> = {
  [SYSTEM_CATEGORY_SLUGS.BOOK]: 'book-outline',
  [SYSTEM_CATEGORY_SLUGS.CD]: 'disc-outline',
  [SYSTEM_CATEGORY_SLUGS.DVD]: 'film-outline',
};

const DEFAULT_ICON: IconName = 'pricetag-outline';

export function getCategoryIcon(slug: string): IconName {
  return ICONS_BY_SLUG[slug] ?? DEFAULT_ICON;
}
