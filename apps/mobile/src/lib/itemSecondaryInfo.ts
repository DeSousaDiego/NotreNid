import type { Item } from '@notre-nid/shared';

/** Auteur/artiste/réalisateur selon la catégorie — réutilisé par ItemCard et RecentItemRow. */
export function secondaryInfoForItem(item: Item): string | null {
  if (item.book?.author) return item.book.author;
  if (item.cd?.artist) return item.cd.artist;
  if (item.dvd?.director) return item.dvd.director;
  return null;
}
