import type { RawUpcItemDbResponseFixture } from './types';

/**
 * Cheerios, contrôle négatif non-vidéo — barcode réellement interrogé pendant
 * le POC UPCitemdb pour confirmer qu'un produit sans rapport n'est jamais
 * classé vidéo (voir docs/DECISIONS.md Bloc 3C). Aucun mot-clé "DVD"/
 * "Blu-ray" dans le titre/la description ⇒ `mediaType: 'unknown'` ⇒
 * `not_video`, aplati en `no_match` par `DvdBarcodeResolverService` — TMDB ne
 * doit alors jamais être appelé.
 */
export const CHEERIOS_BARCODE = '016000487727';

export const CHEERIOS_FIXTURE: RawUpcItemDbResponseFixture = {
  code: 'OK',
  total: 1,
  offset: 0,
  items: [
    {
      upc: CHEERIOS_BARCODE,
      ean: `0${CHEERIOS_BARCODE}`,
      title: 'Cheerios Toasted Whole Grain Oat Cereal, 12 oz',
      description: 'Whole grain oats, gluten free',
      brand: 'General Mills',
      category: 'Food, Beverages & Tobacco > Food Items > Breakfast Foods > Cereal',
      images: ['https://example-fixture.test/upcitemdb/cheerios-box.jpg'],
      offers: [],
    },
  ],
};
