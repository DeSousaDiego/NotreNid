import type { DvdProviderSource } from '../types/barcode-result.types';
import type { DvdProductResult } from '../types/dvd-poc.types';

/** Jeton d'injection Nest du provider produit `dvd` choisi par
 * `DVD_PRODUCT_PROVIDER` (voir `dvd-product-provider.factory.ts`). */
export const DVD_PRODUCT_PROVIDER = Symbol('DVD_PRODUCT_PROVIDER');

export type DvdProductLookupOutcome =
  | { status: 'matched'; result: DvdProductResult }
  | { status: 'no_match' }
  /** Produit connu et validé, mais aucun signal vidéo (ni mot-clé DVD/Blu-ray,
   * ni catégorie vidéo) — `result` conservé pour inspection/logs uniquement,
   * jamais exposé comme `matched` par `DvdBarcodeResolverService`. */
  | { status: 'not_video'; result: DvdProductResult };

/**
 * Contrat d'un fournisseur de produit physique pour `dvd` (UPCitemdb,
 * Digit-Eyes) — même schéma que `BookBarcodeProvider`/`CdBarcodeProvider`
 * (`readonly id`, une méthode `lookup`). Un seul provider actif à la fois,
 * choisi par configuration : jamais de fallback automatique entre eux (voir
 * docs/DECISIONS.md — rollback manuel uniquement).
 */
export interface DvdProductProvider {
  readonly id: DvdProviderSource;

  /**
   * @param barcode code déjà validé/normalisé (voir `barcode-validation.util.ts`)
   * @returns `no_match` si le fournisseur a répondu sans produit exploitable
   *   (absent, code invalide, barcode retourné différent) — jamais pour un
   *   problème de quota/authentification/réseau.
   * @throws {BarcodeProviderError} en cas d'échec technique, avec un `kind`
   *   qualifiant la cause (voir `BarcodeProviderErrorKind`).
   */
  lookup(barcode: string): Promise<DvdProductLookupOutcome>;
}
