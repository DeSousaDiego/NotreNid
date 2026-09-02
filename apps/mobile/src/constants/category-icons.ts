import { SYSTEM_CATEGORY_SLUGS } from '@notre-nid/shared';
import type { Ionicons } from '@expo/vector-icons';
import type { ImageSourcePropType } from 'react-native';

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

// Metro/Expo exige un `require()` statique (chemin littéral) par asset — c'est pour
// ça que ce mapping doit être le SEUL endroit du code qui en écrit un pour ces
// illustrations (Bloc 4) ; tout affichage visuel de catégorie passe par
// `getCategoryIllustration`/`<CategoryIllustration>` plutôt que de dupliquer ces
// `require()` ailleurs.
const ILLUSTRATIONS_BY_SLUG: Record<string, ImageSourcePropType> = {
  [SYSTEM_CATEGORY_SLUGS.BOOK]: require('../../assets/categories/notre-nid-book.png'),
  [SYSTEM_CATEGORY_SLUGS.CD]: require('../../assets/categories/notre-nid-cd.png'),
  [SYSTEM_CATEGORY_SLUGS.DVD]: require('../../assets/categories/notre-nid-dvd.png'),
};

/**
 * Illustration officielle d'une catégorie système, ou `null` pour une catégorie
 * personnalisée (aucune illustration dédiée n'existe côté design) — dans ce cas,
 * l'appelant doit se rabattre sur `getCategoryIcon` (voir `CategoryIllustration`).
 */
export function getCategoryIllustration(slug: string): ImageSourcePropType | null {
  return ILLUSTRATIONS_BY_SLUG[slug] ?? null;
}
