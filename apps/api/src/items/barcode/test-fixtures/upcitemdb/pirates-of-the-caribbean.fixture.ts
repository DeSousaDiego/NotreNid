import type { RawUpcItemDbResponseFixture } from './types';

/**
 * Pirates of the Caribbean: At World's End, combo DVD + Blu-ray — barcode
 * réellement interrogé pendant le POC UPCitemdb (voir docs/DECISIONS.md
 * Bloc 3C, déjà réutilisé pour les fixtures de `dvd-barcode-resolver.service
 * .spec.ts`). `category` trompeuse conservée telle que documentée
 * ("Electronics > Video > Televisions").
 */
export const PIRATES_BARCODE = '786936815481';

export const PIRATES_FIXTURE: RawUpcItemDbResponseFixture = {
  code: 'OK',
  total: 1,
  offset: 0,
  items: [
    {
      upc: PIRATES_BARCODE,
      ean: `0${PIRATES_BARCODE}`,
      title: "Pirates of the Caribbean: At World's End (DVD + 2-Disc Blu-ray)",
      description: 'Bloopers of the Caribbean',
      brand: 'Disney',
      category: 'Electronics > Video > Televisions',
      images: ['https://example-fixture.test/upcitemdb/pirates-cover.jpg'],
      offers: [],
    },
  ],
};
