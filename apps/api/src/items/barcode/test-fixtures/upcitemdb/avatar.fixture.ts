import type { RawUpcItemDbResponseFixture } from './types';

/**
 * Avatar (2009), Blu-ray collector — barcode réellement interrogé pendant le
 * POC UPCitemdb (voir docs/DECISIONS.md Bloc 3C/3D). Bonus (non exigé par le
 * lot public `dvd`), conservé pour exercer deux cas réels documentés en un
 * seul fixture : le suffixe retailer "by X by Y (CODE)" (exige deux
 * occurrences de " by " avant d'être retiré, voir `stripTrailingByClause`) et
 * l'absence d'`images` exploitable côté UPCitemdb (`category`/`images` vides,
 * comme documenté) — ce qui force le repli sur le poster TMDB pour la
 * couverture (voir `buildCoverUrl`).
 */
export const AVATAR_BARCODE = '792266015255';

export const AVATAR_FIXTURE: RawUpcItemDbResponseFixture = {
  code: 'OK',
  total: 1,
  offset: 0,
  items: [
    {
      upc: AVATAR_BARCODE,
      ean: `0${AVATAR_BARCODE}`,
      title:
        "Avatar (Three-Disc Extended Collector's Edition, Blu-ray) by 20th Century Fox by James Cameron (B01GWD9VG2)",
      description: '',
      brand: '',
      category: '',
      images: [],
      offers: [],
    },
  ],
};
