import type { RawUpcItemDbResponseFixture } from './types';

/**
 * "9" (2009), Blu-ray standalone — un des barcodes réellement interrogés
 * pendant le POC UPCitemdb (voir docs/DECISIONS.md Bloc 3C). Reconstruite à
 * partir des observations documentées (titre exact "9 (Blu-ray Disc, 2009)",
 * `category` générique "Media") — les corps JSON bruts n'ont pas été
 * persistés en fichier pendant la session du POC, seulement inspectés en
 * direct ; cette fixture reproduit fidèlement leur forme et leur contenu
 * documentés, jamais un champ inventé.
 */
export const NINE_BLURAY_BARCODE = '065935831686';

export const NINE_BLURAY_FIXTURE: RawUpcItemDbResponseFixture = {
  code: 'OK',
  total: 1,
  offset: 0,
  items: [
    {
      upc: NINE_BLURAY_BARCODE,
      ean: `0${NINE_BLURAY_BARCODE}`,
      title: '9 (Blu-ray Disc, 2009)',
      description: '',
      brand: 'Focus Features',
      category: 'Media',
      images: ['https://example-fixture.test/upcitemdb/nine-bluray-cover.jpg'],
      offers: [],
    },
  ],
};
