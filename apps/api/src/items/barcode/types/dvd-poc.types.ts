/**
 * Types INTERNES du pipeline `dvd` (provider produit + TMDB) — jamais exposés
 * directement au mobile. `DvdBarcodeResolverService` les traduit vers le
 * contrat public (`BarcodeResolveResponse`/`DvdMetadataResult`, voir
 * `barcode-result.types.ts`) avant de répondre : mêmes raisons que les types
 * internes `MusicBrainzRelease`/`MusicBrainzArtistLookupResponse`
 * (`musicbrainz.provider.ts`) — des représentations de travail, pas la forme
 * finale envoyée au mobile. Neutres vis-à-vis du fournisseur produit
 * (UPCitemdb ou Digit-Eyes, voir `DvdProductProvider`).
 */

/** Format déduit UNIQUEMENT d'un mot-clé explicite ("DVD"/"Blu-ray") dans le
 * texte propre du produit (voir `detectMediaType`), jamais des catégories.
 * `'video'` : vidéo confirmée par les catégories du fournisseur (voir
 * `hasVideoCategory`) sans mot-clé de format — jamais forcé en DVD/Blu-ray.
 * `'unknown'` : aucun signal vidéo — traité comme `not_video` par le provider,
 * jamais comme un DVD par défaut. */
export type DvdMediaType = 'dvd' | 'bluray' | 'video' | 'unknown';

/**
 * Résultat normalisé d'un produit physique pour la catégorie `dvd` — ne
 * contient QUE des champs réellement observés chez les fournisseurs (voir
 * docs/DECISIONS.md), jamais un champ deviné. Ne remplit JAMAIS
 * `director`/`runtime`/`country` : aucun fournisseur produit n'a ces signaux
 * de façon fiable, c'est le rôle exclusif de `TmdbMovieResult` (voir
 * `DvdEnrichmentService`).
 */
export interface DvdProductResult {
  barcode: string;
  rawTitle: string | null;
  description: string | null;
  /** Studio/distributeur — passthrough brut du fournisseur, jamais normalisé
   * (même principe que `CdMetadata.label`). */
  brand: string | null;
  /** Catégorie(s) brute(s) du fournisseur, conservée(s) pour inspection —
   * jamais utilisée(s) pour déduire le FORMAT (voir `DvdMediaType`). */
  category: string | null;
  /** URL brute du fournisseur, jamais validée ici — voir
   * `ProductImageValidator` pour la politique d'exposition. */
  imageUrl: string | null;
  mediaType: DvdMediaType;
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
 * (jamais pour l'édition physique, voir `DvdProductResult` et
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
