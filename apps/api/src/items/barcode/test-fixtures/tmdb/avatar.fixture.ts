import type { TmdbSearchResult } from '../../providers/tmdb.provider';
import type { TmdbMovieResult } from '../../types/dvd-poc.types';

/**
 * Réponses TMDB réelles pour `search("Avatar", null)` / `getDetails(19995)` —
 * reproduit fidèlement la "preuve réelle n°1" documentée dans
 * docs/DECISIONS.md (Bloc 3D) : trois candidats au titre exactement "Avatar"
 * (dont deux ici, popularités 58.25 vs 2.1) et "Avatar: Fire and Ash", plus
 * populaire (80.7) mais pas un titre exact — doit être écarté avant même la
 * comparaison de popularité. `production_countries: [US, GB]` également
 * repris tel que documenté.
 */
export const AVATAR_TMDB_SEARCH_RESULTS: TmdbSearchResult[] = [
  { id: 19995, title: 'Avatar', release_date: '2009-12-10', popularity: 58.25 },
  { id: 82693, title: 'Avatar', release_date: '2011-06-03', popularity: 2.1 },
  { id: 891699, title: 'Avatar: Fire and Ash', release_date: '2025-12-19', popularity: 80.7 },
];

export const AVATAR_TMDB_DETAILS: TmdbMovieResult = {
  id: 19995,
  title: 'Avatar',
  overview: 'A paraplegic Marine dispatched to the moon Pandora on a unique mission...',
  releaseYear: 2009,
  runtime: 162,
  director: 'James Cameron',
  countryCodes: ['US', 'GB'],
  posterUrl: 'https://image.tmdb.org/t/p/w500/avatar-poster.jpg',
};
