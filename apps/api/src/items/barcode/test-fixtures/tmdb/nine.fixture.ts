import type { TmdbSearchResult } from '../../providers/tmdb.provider';
import type { TmdbMovieResult } from '../../types/dvd-poc.types';

/**
 * Réponses TMDB réalistes pour `search("9", 2009)` / `getDetails(12244)` —
 * reconstruites à partir de la "preuve réelle n°2" documentée dans
 * docs/DECISIONS.md (Bloc 3D) : deux candidats réels au titre exactement "9"
 * la même année (popularités 16.8 vs 0.82) et "District 9", plus populaire
 * (17.5) mais pas un titre exact — le scoring doit écarter "District 9"
 * avant même de considérer sa popularité, puis départager les deux "9" par
 * popularité.
 */
export const NINE_TMDB_SEARCH_RESULTS: TmdbSearchResult[] = [
  { id: 12244, title: '9', release_date: '2009-09-09', popularity: 16.8 },
  { id: 84433, title: '9', release_date: '2009-01-01', popularity: 0.82 },
  { id: 22803, title: 'District 9', release_date: '2009-08-14', popularity: 17.5 },
];

export const NINE_TMDB_DETAILS: TmdbMovieResult = {
  id: 12244,
  title: '9',
  overview:
    "Dans un futur post-apocalyptique, une poupée de tissu s'éveille et doit affronter les machines qui ont exterminé l'humanité.",
  releaseYear: 2009,
  runtime: 79,
  director: 'Shane Acker',
  countryCodes: ['US'],
  posterUrl: 'https://image.tmdb.org/t/p/w500/nine-poster.jpg',
};
