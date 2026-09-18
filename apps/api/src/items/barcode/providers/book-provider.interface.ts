import type { BookProviderLookupResult, BookProviderSource } from '../types/barcode-result.types';

/**
 * Contrat commun à tout provider de résolution "livre par ISBN". Un futur
 * provider CD (MusicBrainz) ou DVD (un provider UPC) suivra le même schéma
 * (`readonly id`, une méthode `lookup` par identifiant, `null`/exception plutôt
 * qu'un résultat partiellement inventé) avec son propre type de métadonnées —
 * volontairement pas généralisé en un seul type paramétré tant qu'un seul
 * provider existe réellement par catégorie : la généralisation prématurée
 * masquerait les différences réelles entre fournisseurs (MusicBrainz n'a pas
 * de notion de "description", par exemple) derrière une abstraction commune.
 */
export interface BookBarcodeProvider {
  readonly id: BookProviderSource;

  /**
   * @param isbn ISBN-13 déjà validé/normalisé (voir `barcode-validation.util.ts`)
   * @returns `null` si le provider a répondu mais sans résultat exploitable
   *   (jamais un objet partiellement rempli pour signaler ce cas).
   * @throws {BarcodeProviderError} en cas d'échec réseau, timeout, statut HTTP
   *   inattendu ou réponse illisible — jamais une erreur générique non typée.
   */
  lookup(isbn: string): Promise<BookProviderLookupResult | null>;
}
