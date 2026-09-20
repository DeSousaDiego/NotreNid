import type { BarcodeCategory } from './barcode-category.type';

/**
 * `matched` : au moins un provider a renvoyé un résultat exploitable.
 * `no_match` : la recherche a bien eu lieu (chez tous les providers de la
 * chaîne), sans résultat exploitable — pas une erreur.
 * `unsupported` : catégorie pas encore implémentée (`cd`/`dvd` pour l'instant)
 * — aucune recherche n'a été tentée, à ne jamais confondre avec `no_match`.
 * `provider_error` : tous les providers de la chaîne ont échoué (réseau,
 * timeout, réponse invalide) — on ne sait pas s'il y a match ou non.
 */
export type BarcodeResolveStatus = 'matched' | 'no_match' | 'unsupported' | 'provider_error';

export type BookProviderSource = 'google-books' | 'open-library';

/** Cover Art Archive n'est jamais une `source` à lui seul : il n'enrichit qu'un
 * match MusicBrainz déjà trouvé (voir `MusicBrainzProvider`), jamais consulté
 * seul ni capable de produire un match. */
export type CdProviderSource = 'musicbrainz';

export type BarcodeProviderSource = BookProviderSource | CdProviderSource;

/** Toujours `string | null` / `number | null` — jamais de valeur inventée : un
 * champ absent chez le provider reste `null`, jamais une chaîne vide ni une
 * valeur déduite. */
export interface BookMetadataResult {
  author: string | null;
  isbn: string | null;
  publisher: string | null;
  publicationYear: number | null;
  language: string | null;
  pageCount: number | null;
  /** Format physique de l'édition (ex. "Hardcover", "Mass Market Paperback"),
   * texte brut du fournisseur — jamais normalisé ici (voir docs/DECISIONS.md).
   * La traduction en français lisible se fait à l'affichage mobile. */
  format: string | null;
}

/** Résultat normalisé qu'un provider retourne à son resolver — jamais la
 * réponse brute du fournisseur externe, qui ne doit jamais atteindre le mobile. */
export interface BookProviderLookupResult {
  title: string | null;
  description: string | null;
  book: BookMetadataResult;
  coverUrl: string | null;
}

/** Toujours `string | null` / `number | null` — jamais de valeur inventée (même
 * convention que `BookMetadataResult`). Pas de `description` : MusicBrainz n'a
 * pas de notion de résumé/synopsis pour une release (voir docs/DECISIONS.md).
 * Pas de champ pays : aucun signal fiable sur le pays de l'artiste n'est
 * disponible sans requête MusicBrainz supplémentaire par artiste, ce que le
 * budget de requêtes (~1/s) ne permet pas raisonnablement ici — voir
 * docs/DECISIONS.md. */
export interface CdMetadataResult {
  artist: string | null;
  releaseYear: number | null;
  label: string | null;
  /** Type de boîtier/packaging (ex. "Jewel Case", "Digipak"), pas le support
   * (CD, 2×CD…) — déjà connu via la catégorie. Voir docs/DECISIONS.md. */
  format: string | null;
}

/** `coverUrl` est rempli par `MusicBrainzProvider` lui-même (via Cover Art
 * Archive, à partir du MBID de la release retenue) — jamais par le resolver :
 * même contrat que `BookProviderLookupResult.coverUrl`, pour que
 * `CdBarcodeResolverService.finalize` reste un décalque exact de
 * `BookBarcodeResolverService.finalize`. */
export interface CdProviderLookupResult {
  title: string | null;
  cd: CdMetadataResult;
  coverUrl: string | null;
}

export interface BarcodeResolveData {
  title: string | null;
  description: string | null;
  book: BookMetadataResult | null;
  cd: CdMetadataResult | null;
}

export interface BarcodeResolveCover {
  url: string;
}

/** Réponse stable de `POST /items/barcode/resolve`, indépendante du fournisseur
 * ayant produit le résultat (voir `source`) et de la catégorie (`data.book`/
 * `data.cd` restent `null` pour toute catégorie qui n'est pas la leur, ou tant
 * que `dvd` n'est pas implémenté — jamais un faux bloc vide `{}`). */
export interface BarcodeResolveResponse {
  barcode: string;
  category: BarcodeCategory;
  status: BarcodeResolveStatus;
  /** Raccourci équivalent à `status === 'matched'` — préférer `status` pour
   * distinguer précisément `no_match` / `unsupported` / `provider_error`. */
  match: boolean;
  source: BarcodeProviderSource | null;
  data: BarcodeResolveData | null;
  cover: BarcodeResolveCover | null;
}
