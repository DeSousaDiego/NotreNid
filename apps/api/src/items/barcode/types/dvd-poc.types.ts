/**
 * Types INTERNES du pipeline `dvd` (UPCitemdb + TMDB) — jamais exposés
 * directement au mobile. `DvdBarcodeResolverService` les traduit vers le
 * contrat public (`BarcodeResolveResponse`/`DvdMetadataResult`, voir
 * `barcode-result.types.ts`) avant de répondre : mêmes raisons que les types
 * internes `MusicBrainzRelease`/`MusicBrainzArtistLookupResponse`
 * (`musicbrainz.provider.ts`) — des représentations de travail (résultat brut
 * UPCitemdb, résultat brut TMDB), pas la forme finale envoyée au mobile.
 */

/** `mediaType` n'est JAMAIS déduit de `category` (voir docs/DECISIONS.md —
 * champ observé vide ou trompeur sur les DVD/Blu-ray réels testés) : dérivé
 * uniquement d'un mot-clé explicite ("DVD"/"Blu-ray") dans `title`/
 * `description`. `'unknown'` signifie qu'aucun des deux mots-clés n'a été
 * trouvé — traité comme `not_video` par le provider, jamais comme un DVD par
 * défaut. */
export type UpcItemDbMediaType = 'dvd' | 'bluray' | 'unknown';

/**
 * Résultat normalisé d'un item UPCitemdb pour la catégorie `dvd` — ne
 * contient QUE des champs réellement observés dans les réponses réelles
 * (voir docs/DECISIONS.md pour le détail des appels de vérification), jamais
 * un champ deviné. Ne remplit JAMAIS `director`/`runtime`/`country` :
 * UPCitemdb n'a structurellement aucun de ces signaux, c'est le rôle exclusif
 * de `TmdbMovieResult` (voir `DvdEnrichmentService`).
 */
export interface UpcItemDbPocResult {
  barcode: string;
  rawTitle: string | null;
  description: string | null;
  /** Studio/distributeur — passthrough brut de `item.brand`, jamais normalisé
   * (même principe que `CdMetadata.label`). */
  brand: string | null;
  /** Conservé pour inspection uniquement — jamais utilisé pour la
   * classification `mediaType` (voir ce fichier, `UpcItemDbMediaType`). */
  category: string | null;
  imageUrl: string | null;
  mediaType: UpcItemDbMediaType;
  /** Ex. "Collector's Edition", "Director's Cut" — `null` si aucun motif
   * explicite reconnu, jamais une valeur approximée. */
  editionHint: string | null;
  /** Ex. "Region 1", "Region Free" — `null` par défaut : aucun des DVD/Blu-ray
   * réels testés pendant ce POC n'exposait ce signal, voir docs/DECISIONS.md. */
  regionHint: string | null;
  /** Ex. "Three-Disc", "Box Set" — `null` si aucun motif explicite reconnu. */
  packagingHint: string | null;
}

/**
 * Résultat TMDB normalisé — source de vérité pour l'ŒUVRE cinématographique
 * (jamais pour l'édition physique, voir `UpcItemDbPocResult` et
 * docs/DECISIONS.md). `countryCodes` déjà filtré aux codes ISO 3166-1
 * alpha-2 reconnus (voir `iso-country-codes.constant.ts`) — jamais un code
 * TMDB invalide propagé tel quel.
 */
export interface TmdbMovieResult {
  id: number;
  title: string | null;
  overview: string | null;
  releaseYear: number | null;
  runtime: number | null;
  director: string | null;
  countryCodes: string[];
  posterUrl: string | null;
}
