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
}

/** Résultat normalisé qu'un provider retourne à son resolver — jamais la
 * réponse brute du fournisseur externe, qui ne doit jamais atteindre le mobile. */
export interface BookProviderLookupResult {
  title: string | null;
  description: string | null;
  book: BookMetadataResult;
  coverUrl: string | null;
}

export interface BarcodeResolveData {
  title: string | null;
  description: string | null;
  book: BookMetadataResult | null;
}

export interface BarcodeResolveCover {
  url: string;
}

/** Réponse stable de `POST /items/barcode/resolve`, indépendante du fournisseur
 * ayant produit le résultat (voir `source`) et de la catégorie (`data.book` est
 * `null` pour `cd`/`dvd` tant qu'ils ne sont pas implémentés — jamais un faux
 * bloc vide `{}`). */
export interface BarcodeResolveResponse {
  barcode: string;
  category: BarcodeCategory;
  status: BarcodeResolveStatus;
  /** Raccourci équivalent à `status === 'matched'` — préférer `status` pour
   * distinguer précisément `no_match` / `unsupported` / `provider_error`. */
  match: boolean;
  source: BookProviderSource | null;
  data: BarcodeResolveData | null;
  cover: BarcodeResolveCover | null;
}
