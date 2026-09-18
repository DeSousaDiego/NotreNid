/**
 * Duplique volontairement les slugs de `SYSTEM_CATEGORY_SLUGS`
 * (`packages/shared/src/types/category.ts`) — l'API ne dépend d'aucun package
 * workspace en runtime (voir `apps/api/src/items/iso-country-codes.constant.ts`
 * pour la même règle appliquée aux codes pays). Tenir synchronisé si un futur
 * slug de catégorie système est ajouté.
 */
export const BARCODE_CATEGORIES = ['book', 'cd', 'dvd'] as const;
export type BarcodeCategory = (typeof BARCODE_CATEGORIES)[number];
