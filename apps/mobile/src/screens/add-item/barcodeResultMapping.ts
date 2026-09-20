import type { ResolveBarcodeResult } from '@notre-nid/api-client';

import type { ItemFormValues } from '../item-form/schema';

/**
 * Traduit un résultat de scan `matched` en un sous-ensemble de `ItemFormValues`
 * à fusionner dans le brouillon (voir `AddItemDraftContext.setValues`, qui
 * fusionne `metadata` champ par champ plutôt que de le remplacer en bloc).
 *
 * Ne préremplit **jamais** `condition`, `rating`, `notes` ou `ownerIds` : ce
 * sont des informations propres à cet exemplaire précis (état physique,
 * appréciation personnelle, propriétaires du foyer), qu'aucun fournisseur
 * externe ne peut connaître — les laisser à leurs valeurs par défaut du
 * formulaire, à renseigner par l'utilisateur.
 *
 * N'ajoute une clé que si le fournisseur a effectivement renvoyé une valeur
 * exploitable (jamais une chaîne vide ou une valeur inventée) — un champ
 * absent chez le fournisseur reste absent ici, ce qui, combiné à la fusion
 * champ par champ de `setValues`, ne touche jamais un champ déjà saisi par
 * l'utilisateur pour cette clé.
 */
export function buildDraftValuesFromBarcodeResult(
  result: ResolveBarcodeResult,
): Partial<ItemFormValues> {
  const values: Partial<ItemFormValues> = { barcode: result.barcode };

  if (result.data?.title) values.title = result.data.title;
  if (result.data?.description) values.description = result.data.description;
  // URL distante (Google Books/Open Library), jamais réimportée dans notre
  // stockage à ce stade (voir docs/DECISIONS.md) — `useCoverPicker` l'affiche
  // et la retire proprement sans jamais tenter de la supprimer côté API
  // (`removeImage` n'appelle l'API que si un upload a réellement eu lieu
  // cette session, ce qui n'est pas le cas d'une couverture prérempli ainsi).
  if (result.cover?.url) values.coverImageUrl = result.cover.url;

  const book = result.data?.book;
  if (book) {
    const metadata: Record<string, string> = {};
    if (book.author) metadata.author = book.author;
    if (book.isbn) metadata.isbn = book.isbn;
    if (book.publisher) metadata.publisher = book.publisher;
    if (book.publicationYear != null) metadata.publicationYear = String(book.publicationYear);
    if (book.language) metadata.language = book.language;
    if (book.pageCount != null) metadata.pageCount = String(book.pageCount);
    // Valeur brute du fournisseur (ex. "Hardcover"), jamais traduite ici — la
    // traduction française lisible ne se fait qu'à l'affichage (voir
    // `formatBookFormatLabel`), jamais au stockage.
    if (book.format) metadata.format = book.format;
    if (Object.keys(metadata).length > 0) values.metadata = metadata;
  }

  // `result.data.book`/`result.data.cd` sont mutuellement exclusifs (propres à
  // la catégorie demandée) — jamais les deux à la fois pour un même résultat.
  const cd = result.data?.cd;
  if (cd) {
    const metadata: Record<string, string> = {};
    if (cd.artist) metadata.artist = cd.artist;
    if (cd.releaseYear != null) metadata.releaseYear = String(cd.releaseYear);
    if (cd.label) metadata.label = cd.label;
    // Idem `book.format` : valeur brute MusicBrainz, jamais traduite ici.
    if (cd.format) metadata.format = cd.format;
    if (Object.keys(metadata).length > 0) values.metadata = metadata;
  }

  // Pas de `countryCodes` ("pays de l'artiste") préremplis pour un CD : aucun
  // signal fiable disponible sans requête MusicBrainz supplémentaire par
  // artiste — voir docs/DECISIONS.md. Reste à saisir manuellement, comme pour
  // un livre aujourd'hui.

  return values;
}
