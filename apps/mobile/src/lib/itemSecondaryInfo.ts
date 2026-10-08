import type { Item, PublicUser } from '@notre-nid/shared';

/** Auteur/artiste/réalisateur selon la catégorie — réutilisé par ItemCard et RecentItemRow. */
export function secondaryInfoForItem(item: Item): string | null {
  if (item.book?.author) return item.book.author;
  if (item.cd?.artist) return item.cd.artist;
  if (item.dvd?.director) return item.dvd.director;
  return null;
}

/** Année de publication (livre) ou de sortie (CD/DVD) — `null` si absente. */
export function yearForItem(item: Item): number | null {
  return item.book?.publicationYear ?? item.cd?.releaseYear ?? item.dvd?.releaseYear ?? null;
}

/**
 * Ligne « créateur · année » affichée sous le titre de la fiche détail (ex.
 * « Albert Camus · 1942 »). Chaque partie absente est simplement omise ; `null`
 * si aucune n'est connue (catégorie personnalisée notamment) — jamais de
 * placeholder.
 */
export function creditLineForItem(item: Item): string | null {
  const year = yearForItem(item);
  const parts = [secondaryInfoForItem(item), year ? String(year) : null].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

const MAX_NAMED_OWNERS = 3;

/**
 * Propriétaires en toutes lettres : « À Julie », « À Julie et Diego »,
 * « À Julie, Diego et Sam », au-delà « À Julie, Diego et 2 autres ». `null` si la
 * liste est vide (un item a toujours au moins un propriétaire côté API, mais un
 * compte supprimé ne doit jamais produire « À  »).
 */
export function ownersPhrase(owners: Pick<PublicUser, 'displayName'>[]): string | null {
  const names = owners.map((owner) => owner.displayName.trim()).filter(Boolean);
  if (names.length === 0) return null;
  if (names.length === 1) return `À ${names[0]}`;
  if (names.length <= MAX_NAMED_OWNERS) {
    return `À ${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
  }
  const others = names.length - (MAX_NAMED_OWNERS - 1);
  return `À ${names.slice(0, MAX_NAMED_OWNERS - 1).join(', ')} et ${others} autres`;
}
