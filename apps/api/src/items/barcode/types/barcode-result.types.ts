import type { BarcodeCategory } from './barcode-category.type';

/**
 * `matched` : au moins un provider a renvoyé un résultat exploitable.
 * `partial` : propre à `dvd` (voir `DvdMetadataResult`) — le produit physique
 * a été identifié (UPCitemdb) mais le FILM ne l'a pas été avec assez de
 * confiance (recherche TMDB sans candidat suffisant, y compris un coffret
 * multi-films jamais forcé vers un seul titre) ou TMDB a subi une panne
 * technique non bloquante — `data.dvd` ne contient alors que les champs
 * fiables issus d'UPCitemdb, jamais une valeur TMDB devinée. Jamais utilisé
 * pour `book`/`cd`, qui n'ont pas cette notion de second fournisseur
 * optionnel. Voir docs/DECISIONS.md.
 * `no_match` : la recherche a bien eu lieu (chez tous les providers de la
 * chaîne), sans résultat exploitable — pas une erreur.
 * `unsupported` : catégorie pas encore implémentée — aucune recherche n'a été
 * tentée, à ne jamais confondre avec `no_match`.
 * `provider_error` : tous les providers de la chaîne ont échoué (réseau,
 * timeout, réponse invalide) — on ne sait pas s'il y a match ou non.
 */
export type BarcodeResolveStatus =
  'matched' | 'partial' | 'no_match' | 'unsupported' | 'provider_error';

export type BookProviderSource = 'google-books' | 'open-library';

/** Cover Art Archive n'est jamais une `source` à lui seul : il n'enrichit qu'un
 * match MusicBrainz déjà trouvé (voir `MusicBrainzProvider`), jamais consulté
 * seul ni capable de produire un match. */
export type CdProviderSource = 'musicbrainz';

/** TMDB n'est, de la même façon que Cover Art Archive pour `cd`, jamais une
 * `source` à lui seul : il n'enrichit qu'un produit déjà identifié par
 * UPCitemdb (voir `DvdEnrichmentService`) — `source` reste `'upcitemdb'` que
 * TMDB ait résolu le film (`status: 'matched'`) ou non (`status: 'partial'`). */
export type DvdProviderSource = 'upcitemdb';

export type BarcodeProviderSource = BookProviderSource | CdProviderSource | DvdProviderSource;

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
 * pas de notion de résumé/synopsis pour une release (voir docs/DECISIONS.md). */
export interface CdMetadataResult {
  artist: string | null;
  releaseYear: number | null;
  label: string | null;
  /** Type de boîtier/packaging (ex. "Jewel Case", "Digipak"), pas le support
   * (CD, 2×CD…) — déjà connu via la catégorie. Voir docs/DECISIONS.md. */
  format: string | null;
  /** Code pays ISO 3166-1 alpha-2 de l'ARTISTE principal (ex. "US"), jamais du
   * pays de distribution de cette édition (`release.country`, une notion
   * différente — voir `MusicBrainzProvider`). Nécessite un second appel
   * MusicBrainz par MBID d'artiste, donc `null` par défaut dès qu'il existe le
   * moindre doute sur l'identité de l'artiste principal (plusieurs
   * artist-credit, "Various Artists", MBID absent) plutôt qu'une valeur
   * devinée — voir docs/DECISIONS.md. */
  artistCountry: string | null;
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

/** Toujours `string | null` — jamais de valeur inventée (même convention que
 * `BookMetadataResult`/`CdMetadataResult`). `director`/`releaseYear`/
 * `duration` proviennent EXCLUSIVEMENT de TMDB (`null` en `status: 'partial'`,
 * TMDB n'ayant pas résolu de film) ; `edition`/`region`/`format` proviennent
 * EXCLUSIVEMENT d'UPCitemdb (renseignés dès `status: 'partial'`, dès qu'un
 * produit vidéo physique a été identifié) — jamais l'un à la place de l'autre,
 * voir docs/DECISIONS.md. Pays de production du film : voir
 * `BarcodeResolveData.countryCodes`, pas un champ de cet objet (contrairement
 * à `CdMetadataResult.artistCountry`, resté un champ dédié — décision
 * indépendante, non revue ici). */
export interface DvdMetadataResult {
  director: string | null;
  releaseYear: number | null;
  duration: number | null;
  /** UPCitemdb uniquement (ex. "Collector's Edition") — jamais TMDB, qui n'a
   * aucune notion d'édition physique. */
  edition: string | null;
  /** UPCitemdb uniquement (ex. "Region 1", "Region Free") — jamais TMDB. */
  region: string | null;
  /** Type de boîtier/packaging UPCitemdb uniquement (ex. "Three-Disc", "Box
   * Set") — jamais TMDB, jamais le support (DVD/Blu-ray, déjà la catégorie). */
  format: string | null;
}

export interface BarcodeResolveData {
  title: string | null;
  description: string | null;
  book: BookMetadataResult | null;
  cd: CdMetadataResult | null;
  dvd: DvdMetadataResult | null;
  /** Codes pays ISO 3166-1 alpha-2 — pour l'instant renseigné UNIQUEMENT pour
   * `dvd` (pays de PRODUCTION du film, voir TMDB `production_countries`),
   * toujours `null` pour `book`/`cd` (qui n'exposent pas ce signal à ce
   * niveau — voir `CdMetadataResult.artistCountry` pour le pays de l'artiste
   * CD, un concept et un champ différents, non concernés ici). `null` plutôt
   * qu'un tableau vide dès qu'il n'y a rien à rapporter (catégorie sans ce
   * signal, ou `dvd` sans film résolu, ou film résolu sans pays de
   * production renseigné côté TMDB) — jamais un tableau vide ambigu. */
  countryCodes: string[] | null;
}

export interface BarcodeResolveCover {
  url: string;
}

/** Réponse stable de `POST /items/barcode/resolve`, indépendante du fournisseur
 * ayant produit le résultat (voir `source`) et de la catégorie (`data.book`/
 * `data.cd`/`data.dvd` restent `null` pour toute catégorie qui n'est pas la
 * leur — jamais un faux bloc vide `{}`). */
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
