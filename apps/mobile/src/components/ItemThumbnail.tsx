import { getCategoryCoverTint } from '../constants/category-icons';
import { useTheme } from '../theme';

import { ItemCover } from './ItemCover';

/** Miniature portrait des listes, identique pour toutes les catégories : les lignes
 * Livre/CD/DVD gardent la même hauteur et la même colonne de texte. */
export const ITEM_THUMBNAIL_WIDTH = 48;
export const ITEM_THUMBNAIL_HEIGHT = 64;

export interface ItemThumbnailProps {
  uri: string | null | undefined;
  categorySlug: string;
}

/**
 * Couverture d'un objet dans une liste (Accueil « Ajouts récents », Collection,
 * Archives) — seule définition de ce traitement, pour qu'il ne diverge plus d'un
 * écran à l'autre. La teinte de catégorie (sauge/pêche/miel, lin pour une catégorie
 * personnalisée) est le CONTENEUR de la couverture, pas seulement un repli : une
 * vraie image s'y affiche en `contain` (un CD carré est centré, la teinte reste
 * visible autour) ; sans image, l'illustration de catégorie est centrée dessus.
 */
export function ItemThumbnail({ uri, categorySlug }: ItemThumbnailProps) {
  const theme = useTheme();

  return (
    <ItemCover
      testID="item-thumbnail"
      uri={uri}
      categorySlug={categorySlug}
      illustrationSize={32}
      transition={150}
      style={{
        width: ITEM_THUMBNAIL_WIDTH,
        height: ITEM_THUMBNAIL_HEIGHT,
        borderRadius: theme.radii.sm,
        backgroundColor: theme.colors[getCategoryCoverTint(categorySlug)],
      }}
    />
  );
}
