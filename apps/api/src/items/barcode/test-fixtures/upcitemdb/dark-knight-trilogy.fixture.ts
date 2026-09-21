import type { RawUpcItemDbResponseFixture } from './types';

/**
 * The Dark Knight Trilogy, coffret Blu-ray — barcode réellement interrogé
 * pendant le POC UPCitemdb (voir docs/DECISIONS.md Bloc 3C). `category`
 * reconstruite fidèlement telle que documentée ("Electronics > Video > Video
 * Players & Recorders > DVD & Blu-ray Players" — décrit un LECTEUR, jamais
 * utilisée pour la classification, voir `detectMediaType`). L'indice
 * "6-Disc" n'apparaissait, comme documenté, que dans `offers[].title`, jamais
 * dans le `title` principal — reproduit ici à l'identique.
 */
export const DARK_KNIGHT_TRILOGY_BARCODE = '883929308002';

export const DARK_KNIGHT_TRILOGY_FIXTURE: RawUpcItemDbResponseFixture = {
  code: 'OK',
  total: 1,
  offset: 0,
  items: [
    {
      upc: DARK_KNIGHT_TRILOGY_BARCODE,
      ean: `0${DARK_KNIGHT_TRILOGY_BARCODE}`,
      title: 'The Dark Knight Trilogy (Blu-ray)',
      description: '',
      brand: 'Warner Home Video',
      category: 'Electronics > Video > Video Players & Recorders > DVD & Blu-ray Players',
      images: ['https://example-fixture.test/upcitemdb/dark-knight-trilogy-cover.jpg'],
      offers: [{ title: 'The Dark Knight Trilogy 6-Disc Blu-ray Box Set' }],
    },
  ],
};
