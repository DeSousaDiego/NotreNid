import type { DigitEyesFixture } from './types';

/** The Dark Knight Trilogy (coffret) — réponse réelle du 2026-10-06. Le titre
 * ne contient NI "DVD" NI "Blu-ray" : seul `categories` atteste qu'il s'agit
 * d'une vidéo (cas décisif du POC). `usage` = texte de vendeur. Image HTTPS
 * accessible (200). */
export const DIGITEYES_DARK_KNIGHT_TRILOGY: DigitEyesFixture = {
  barcode: '883929308002',
  response: {
    upc_code: '0883929308002',
    return_code: '0',
    return_message: 'Success',
    description:
      'The Dark Knight Trilogy: Ultimate Collectors Edition (batman Begins / the Dark Knight / the Dark Knight Rises)',
    brand: 'Warner Bros.',
    categories:
      'Action & Adventure, Batman Movie & TV Shows, Batman Movies, Batman TV Shows, Blu-ray, Blu-ray HD DVD, Blu-ray Movies, Blu-ray Region A Usa, DC Comics Characters, DVD, DVD Movies, Movie Series, Movies, Movies & TV Shows, Movies Music & Books, Null, Shop By Character, Warner Bros, the Exchange Stores',
    image: 'https://cdn-r.fishpond.com/0036/736/815/1204596519/6.jpeg',
    usage: 'Buy with confidence. Excellent Customer Service & Return policy.',
    uom: null,
    manufacturer: { company: 'Warner Home Video' },
  },
};
