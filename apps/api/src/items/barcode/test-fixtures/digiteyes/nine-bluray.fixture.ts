import type { DigitEyesFixture } from './types';

/** "9" (2009), Blu-ray — réponse réelle `field_names=all,categories` du
 * 2026-10-06. Format porté par le titre ("[blu-ray]"), région "[region 1]",
 * année en crochets, groupe vide "[]" ; `brand` = un producteur (bruit
 * fournisseur) ; image eBay HTTPS observée en 404. */
export const DIGITEYES_NINE_BLURAY: DigitEyesFixture = {
  barcode: '065935831686',
  response: {
    upc_code: '0065935831686',
    return_code: '0',
    return_message: 'Success',
    description: '9 [blu-ray] [2009] [region 1] []',
    brand: 'Timur Bekmambetov',
    categories:
      'All Foreign Films, Foreign Movies, French Movies, Movies, Movies & TV Shows, Sci-fi & Fantasy, Timur Bekmambetov',
    image: 'https://i.ebayimg.com/images/i/391954808714-0-0/s-l300/p.jpg',
    usage:
      '[BLU-RAY] [2009] [REGION 1] [065935831686]. 9 [BLU-RAY] [2009] [REGION 1] [065935831686]',
    uom: null,
    manufacturer: { company: null },
  },
};
