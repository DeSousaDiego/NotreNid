import type { DigitEyesFixture } from './types';

/** Avatar, Blu-ray — réponse réelle du 2026-10-06 (fiche importée par
 * Digit-Eyes depuis UPCitemdb, `website: api.upcitemdb.com/`). Ni catégories,
 * ni image : le format vient du titre, la couverture devra venir de TMDB. */
export const DIGITEYES_AVATAR: DigitEyesFixture = {
  barcode: '792266015255',
  response: {
    upc_code: '0792266015255',
    return_code: '0',
    return_message: 'Success',
    description: 'Avatar blu-ray By 20TH Century Fox By James Cameron',
    brand: null,
    categories: null,
    image: null,
    usage: '',
    uom: null,
    manufacturer: { company: null },
  },
};
