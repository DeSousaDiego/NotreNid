import type { TmdbSearchResult } from '../../providers/tmdb.provider';
import type { TmdbMovieResult } from '../../types/dvd-poc.types';

/**
 * Réponses TMDB réelles pour `search("Pirates of the Caribbean: At World's
 * End", null)` / `getDetails(285)` — mêmes valeurs déjà établies dans
 * `dvd-barcode-resolver.service.spec.ts` (id 285, Gore Verbinski, 2007, 169
 * min, ["US"]), reprises ici pour la cohérence entre les deux suites.
 */
export const PIRATES_TMDB_SEARCH_RESULTS: TmdbSearchResult[] = [
  {
    id: 285,
    title: "Pirates of the Caribbean: At World's End",
    release_date: '2007-05-19',
    popularity: 45.2,
  },
];

export const PIRATES_TMDB_DETAILS: TmdbMovieResult = {
  id: 285,
  title: "Pirates of the Caribbean: At World's End",
  overview: 'After losing Captain Jack Sparrow to the locker of Davy Jones...',
  releaseYear: 2007,
  runtime: 169,
  director: 'Gore Verbinski',
  countryCodes: ['US'],
  posterUrl: 'https://image.tmdb.org/t/p/w500/jGWpG4YhpQwVmjyHEGkxEkeRf0S.jpg',
};
