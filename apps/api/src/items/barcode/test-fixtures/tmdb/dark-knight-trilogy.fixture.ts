import type { TmdbSearchResult } from '../../providers/tmdb.provider';

/**
 * Réponse TMDB réelle pour `search("The Dark Knight Trilogy", null)` —
 * reproduit fidèlement la "preuve réelle n°3" documentée dans
 * docs/DECISIONS.md (Bloc 3D) : un SEUL résultat réel, "The Fire Rises: The
 * Creation and Impact of The Dark Knight Trilogy" (2013), un DOCUMENTAIRE sur
 * la trilogie — jamais les films eux-mêmes. `titleMatchTier` doit le classer
 * `'far'` (bien au-delà de la tolérance), donc `selectBestMovieMatch` doit
 * renvoyer `null` : aucun film ne doit être forcé sur un coffret. Pas de
 * fixture `details` associée — `getDetails` ne doit jamais être appelé ici.
 */
export const DARK_KNIGHT_TRILOGY_TMDB_SEARCH_RESULTS: TmdbSearchResult[] = [
  {
    id: 152750,
    title: 'The Fire Rises: The Creation and Impact of The Dark Knight Trilogy',
    release_date: '2013-01-01',
    popularity: 4.2,
  },
];
