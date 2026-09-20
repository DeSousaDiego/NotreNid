import type { CdProviderLookupResult, CdProviderSource } from '../types/barcode-result.types';

/**
 * Contrat "provider CD par code-barres" — même schéma que `BookBarcodeProvider`
 * (`readonly id`, une méthode `lookup` par identifiant, `null`/exception plutôt
 * qu'un résultat partiellement inventé), volontairement pas fusionné dans une
 * interface générique commune : MusicBrainz n'a pas de notion de "description"
 * (contrairement à Google Books/Open Library), et la couverture provient d'un
 * second service (Cover Art Archive) composé à l'intérieur du provider, pas
 * d'une chaîne de fallback comme pour `book` (voir docs/DECISIONS.md).
 */
export interface CdBarcodeProvider {
  readonly id: CdProviderSource;

  /**
   * @param barcode EAN-13/UPC-A déjà validé en forme (voir `ResolveBarcodeDto`)
   *   — aucune normalisation supplémentaire nécessaire pour MusicBrainz,
   *   contrairement à l'ISBN pour `book`.
   * @returns `null` si le provider a répondu mais sans résultat exploitable
   *   (jamais un objet partiellement rempli pour signaler ce cas).
   * @throws {BarcodeProviderError} en cas d'échec réseau, timeout, statut HTTP
   *   inattendu ou réponse illisible — jamais une erreur générique non typée.
   */
  lookup(barcode: string): Promise<CdProviderLookupResult | null>;
}
