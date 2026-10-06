import type { DigitEyesFixture } from './types';

/** Pirates of the Caribbean: At World's End, combo DVD + Blu-ray — réponse
 * réelle du 2026-10-06. Graphie "Worlds" SANS apostrophe (cas de la
 * normalisation `normalizeTitle`), catégorie générique "Blu-ray HD DVD" (ne
 * doit jamais décider du format). Image sur un domaine Azure mort. */
export const DIGITEYES_PIRATES: DigitEyesFixture = {
  barcode: '786936815481',
  response: {
    upc_code: '0786936815481',
    return_code: '0',
    return_message: 'Success',
    description: 'Pirates of the Caribbean: At Worlds End (DVD + 2-disc Blu-ray)',
    brand: 'Disney',
    categories:
      'Adventure, Anime & Animation Movies, Blu-ray HD DVD, Blu-ray Region A Usa, Buena Vista, Children & Family, Disney, Disney Movies, Fantasy Fantasy Adventure, Movies, Movies & TV, Movies & TV Shows, Null, Pirates Of The Caribbean At Wo, the Exchange Stores',
    image: 'https://az721511.vo.msecnd.net/images/159/796072-T.JPG',
    usage:
      "When Captain Jack Sparrow is trapped in Davy Jones' Locker, Will Turner, Elizabeth Swann and Captain Barbossa develop a shaky alliance and begin a desperate quest to rescue him.",
    uom: '2 disc Blu ray',
    manufacturer: { company: 'Walt Disney Studios' },
  },
};
