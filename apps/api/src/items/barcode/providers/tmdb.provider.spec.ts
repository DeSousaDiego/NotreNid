import type { ConfigService } from '@nestjs/config';

import { BarcodeProviderError } from './barcode-provider.error';
import type { TmdbRateLimiterService } from './tmdb-rate-limiter.service';
import {
  TmdbProvider,
  cleanTitleForSearch,
  extractDirector,
  extractYearHint,
  scoreCandidate,
  selectBestMovieMatch,
  titleMatchTier,
  type TmdbSearchResult,
} from './tmdb.provider';

function fakeConfigService(values: Record<string, unknown> = {}): ConfigService {
  return {
    get: (key: string) => (key === 'TMDB_READ_ACCESS_TOKEN' ? 'test-token' : values[key]),
  } as unknown as ConfigService;
}

function passthroughRateLimiter(): TmdbRateLimiterService {
  return { schedule: (task: () => unknown) => task() } as unknown as TmdbRateLimiterService;
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: () => Promise.resolve(body) } as unknown as Response;
}

function unparseableResponse(ok: boolean, status: number): Response {
  return {
    ok,
    status,
    json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
  } as unknown as Response;
}

function makeProvider(configValues: Record<string, unknown> = {}) {
  return new TmdbProvider(fakeConfigService(configValues), passthroughRateLimiter());
}

// ============================================================================
// Fixtures — capturées via des appels RÉELS `GET /3/search/movie` et
// `GET /3/movie/{id}?append_to_response=credits` le 2026-09-21 (voir
// docs/DECISIONS.md pour le détail des appels).
// ============================================================================

const PIRATES_RAW_TITLE = "Pirates of the Caribbean: At World's End (DVD + 2-Disc Blu-ray)";
const AVATAR_RAW_TITLE =
  "Avatar (Three-Disc Extended Collector's Edition + BD-Live) [Blu-ray] by 20th Century Fox by James Cameron (B01GWD9VG2)";
const DARK_KNIGHT_RAW_TITLE = 'The Dark Knight Trilogy [Blu-ray]';
const NINE_RAW_TITLE = '9 (Blu-ray Disc, 2009)';

// Réponse réelle `GET /3/search/movie?query=Pirates+of+the+Caribbean...` — 1
// seul résultat, correspondance exacte.
const PIRATES_TMDB: TmdbSearchResult = {
  id: 285,
  title: "Pirates of the Caribbean: At World's End",
  original_title: "Pirates of the Caribbean: At World's End",
  release_date: '2007-05-19',
  popularity: 36.1765,
};

// Réponse réelle `GET /3/search/movie?query=Avatar` (90 résultats réels,
// échantillon pertinent conservé) — TROIS candidats au titre EXACTEMENT
// "Avatar", popularités très différentes.
const AVATAR_2009: TmdbSearchResult = {
  id: 19995,
  title: 'Avatar',
  original_title: 'Avatar',
  release_date: '2009-12-16',
  popularity: 58.2517,
};
const AVATAR_2011_JP: TmdbSearchResult = {
  id: 282908,
  title: 'Avatar',
  original_title: 'アバター',
  release_date: '2011-04-30',
  popularity: 1.086,
};
const AVATAR_1964: TmdbSearchResult = {
  id: 1544429,
  title: 'Avatar',
  original_title: 'Avatar',
  release_date: '1964-07-22',
  popularity: 1.2857,
};
// Non-exact (superstring) — ne doit jamais l'emporter malgré une popularité
// plus élevée que AVATAR_2009 dans les résultats réels.
const AVATAR_FIRE_AND_ASH: TmdbSearchResult = {
  id: 83533,
  title: 'Avatar: Fire and Ash',
  original_title: 'Avatar: Fire and Ash',
  release_date: '2025-12-17',
  popularity: 80.703,
};

// Réponse réelle `GET /3/search/movie?query=The+Dark+Knight+Trilogy` — UN
// SEUL résultat, un documentaire, PAS les films eux-mêmes (le vrai scénario
// "coffret" que ce lot doit gérer sans forcer un mauvais match).
const DARK_KNIGHT_DOCUMENTARY: TmdbSearchResult = {
  id: 243238,
  title: 'The Fire Rises: The Creation and Impact of The Dark Knight Trilogy',
  original_title: 'The Fire Rises: The Creation and Impact of The Dark Knight Trilogy',
  release_date: '2013-09-24',
  popularity: 2.6294,
};

// Réponse réelle `GET /3/search/movie?query=9&primary_release_year=2009` —
// DEUX candidats au titre EXACTEMENT "9", même année, popularités opposées ;
// "District 9" (non-exact) a une popularité encore plus haute mais ne doit
// jamais l'emporter.
const NINE_2009_MAIN: TmdbSearchResult = {
  id: 12244,
  title: '9',
  original_title: '9',
  release_date: '2009-08-19',
  popularity: 16.8376,
};
const NINE_2009_OBSCURE: TmdbSearchResult = {
  id: 454508,
  title: '9',
  original_title: '9',
  release_date: '2009-04-27',
  popularity: 0.8184,
};
const DISTRICT_NINE: TmdbSearchResult = {
  id: 17654,
  title: 'District 9',
  original_title: 'District 9',
  release_date: '2009-08-05',
  popularity: 17.5093,
};

describe('cleanTitleForSearch', () => {
  it('strips a real DVD+Blu-ray combo bracket, matching the exact real TMDB title', () => {
    expect(cleanTitleForSearch(PIRATES_RAW_TITLE)).toBe("Pirates of the Caribbean: At World's End");
  });

  it('strips edition/packaging/format brackets and a retailer "by X by Y (CODE)" suffix (2+ "by" required)', () => {
    expect(cleanTitleForSearch(AVATAR_RAW_TITLE)).toBe('Avatar');
  });

  it('strips a lone format bracket', () => {
    expect(cleanTitleForSearch(DARK_KNIGHT_RAW_TITLE)).toBe('The Dark Knight Trilogy');
  });

  it('strips a bracket mixing format and year, keeping only the bare title', () => {
    expect(cleanTitleForSearch(NINE_RAW_TITLE)).toBe('9');
  });

  it('never strips a single "by" occurrence — a real title may legitimately contain one (e.g. "Stand by Me")', () => {
    expect(cleanTitleForSearch('Stand by Me [DVD]')).toBe('Stand by Me');
  });

  it('keeps a parenthetical that matches no noise keyword (e.g. a product code)', () => {
    expect(cleanTitleForSearch('Some Movie (B01GWD9VG2)')).toBe('Some Movie (B01GWD9VG2)');
  });

  it('falls back to the raw title when cleaning would leave nothing usable', () => {
    expect(cleanTitleForSearch('[DVD]')).toBe('[DVD]');
  });

  it('returns an empty string only for an empty/whitespace-only input', () => {
    expect(cleanTitleForSearch('   ')).toBe('');
  });
});

describe('extractYearHint', () => {
  it('extracts the year from a real bracketed format+year group', () => {
    expect(extractYearHint(NINE_RAW_TITLE)).toBe(2009);
  });

  it('returns null when no year is present in any bracket (3 of the 4 real titles)', () => {
    expect(extractYearHint(PIRATES_RAW_TITLE)).toBeNull();
    expect(extractYearHint(AVATAR_RAW_TITLE)).toBeNull();
    expect(extractYearHint(DARK_KNIGHT_RAW_TITLE)).toBeNull();
  });

  it('never guesses a year found outside brackets', () => {
    expect(extractYearHint('Movie 2009')).toBeNull();
  });

  it('returns null when several different years appear in brackets — ambiguous, never guessed', () => {
    expect(extractYearHint('Movie (2009) [2010 reissue]')).toBeNull();
  });

  it('accepts the same year repeated across brackets (not ambiguous)', () => {
    expect(extractYearHint('Movie (2009) [Anniversary reissue, 2009]')).toBe(2009);
  });
});

describe('titleMatchTier', () => {
  it('is "exact" after normalization (case/diacritics/punctuation-insensitive)', () => {
    expect(titleMatchTier('avatar', ['Avatar'])).toBe('exact');
    expect(
      titleMatchTier("Pirates of the Caribbean: At World's End", [
        "PIRATES OF THE CARIBBEAN: AT WORLD'S END",
      ]),
    ).toBe('exact');
  });

  it('is "far" for the real documentary title vs the cleaned boxset query — the core boxset guarantee', () => {
    expect(
      titleMatchTier('The Dark Knight Trilogy', [
        DARK_KNIGHT_DOCUMENTARY.title,
        DARK_KNIGHT_DOCUMENTARY.original_title,
      ]),
    ).toBe('far');
  });

  it('is "far" for a superstring like "District 9" vs "9" — never conflated with an exact match', () => {
    expect(titleMatchTier('9', [DISTRICT_NINE.title])).toBe('far');
  });

  it('is "close" for a minor punctuation/spelling difference within tolerance', () => {
    expect(titleMatchTier('Avatar', ['Avataar'])).toBe('close');
  });
});

describe('scoreCandidate', () => {
  it('scores a real exact match at the base exact score when no year hint is available', () => {
    expect(scoreCandidate(PIRATES_TMDB, "Pirates of the Caribbean: At World's End", null)).toBe(
      100,
    );
  });

  it('disqualifies (null) the real documentary candidate for the boxset query', () => {
    expect(scoreCandidate(DARK_KNIGHT_DOCUMENTARY, 'The Dark Knight Trilogy', null)).toBeNull();
  });

  it('adds the year-exact bonus for a real exact-title + exact-year candidate', () => {
    expect(scoreCandidate(NINE_2009_MAIN, '9', 2009)).toBe(120);
  });

  it('penalizes an exact title match whose year clearly contradicts the hint below the threshold', () => {
    // Même titre exact que NINE_2009_MAIN mais une année 2020 imaginée pour ce
    // test : 100 (exact) - 30 (écart >= 2 ans) = 70 < 100, donc rejeté.
    const score = scoreCandidate({ ...NINE_2009_MAIN, release_date: '1975-01-01' }, '9', 2009);
    expect(score).toBe(70);
  });

  it('never lets a "close" title reach the confidence threshold, even with a matching year', () => {
    // "19" vs "9" : distance de Levenshtein 1 (sous tolérance) mais PAS égal
    // après normalisation — contrairement à "9!" (la ponctuation seule est
    // ignorée par la normalisation, donc "9!" serait en réalité 'exact').
    const score = scoreCandidate(
      { ...NINE_2009_MAIN, title: '19', original_title: '19' },
      '9',
      2009,
    );
    // 'close' (60) + bonus année exacte (20) = 80 < 100 — jamais suffisant seul.
    expect(score).toBe(80);
  });
});

describe('selectBestMovieMatch', () => {
  it('selects the single real exact match for Pirates', () => {
    const selection = selectBestMovieMatch(
      [PIRATES_TMDB],
      "Pirates of the Caribbean: At World's End",
      null,
    );
    expect(selection?.id).toBe(285);
  });

  it('breaks a real 3-way exact-title tie (Avatar) by popularity, never picking the higher-popularity non-exact "Fire and Ash"', () => {
    const selection = selectBestMovieMatch(
      [AVATAR_2009, AVATAR_2011_JP, AVATAR_1964, AVATAR_FIRE_AND_ASH],
      'Avatar',
      null,
    );
    expect(selection?.id).toBe(19995);
  });

  it('breaks a real 2-way exact-title+exact-year tie ("9") by popularity, never picking the higher-popularity "District 9"', () => {
    const selection = selectBestMovieMatch(
      [NINE_2009_MAIN, NINE_2009_OBSCURE, DISTRICT_NINE],
      '9',
      2009,
    );
    expect(selection?.id).toBe(12244);
  });

  it('never forces a match for the real boxset case — the documentary is rejected, no candidate returned', () => {
    const selection = selectBestMovieMatch(
      [DARK_KNIGHT_DOCUMENTARY],
      'The Dark Knight Trilogy',
      null,
    );
    expect(selection).toBeNull();
  });

  it('returns null when there are no candidates at all', () => {
    expect(selectBestMovieMatch([], 'Anything', null)).toBeNull();
  });
});

describe('extractDirector', () => {
  it('extracts the single real director (Pirates: Gore Verbinski)', () => {
    expect(
      extractDirector([
        { name: 'Gore Verbinski', job: 'Director' },
        { name: 'Jerry Bruckheimer', job: 'Producer' },
      ]),
    ).toBe('Gore Verbinski');
  });

  it('joins several directors deterministically with ", "', () => {
    expect(
      extractDirector([
        { name: 'Directeur B', job: 'Director' },
        { name: 'Directeur A', job: 'Director' },
      ]),
    ).toBe('Directeur B, Directeur A');
  });

  it('returns null when no crew member has job "Director"', () => {
    expect(extractDirector([{ name: 'Someone', job: 'Producer' }])).toBeNull();
  });

  it('returns null for an empty crew list', () => {
    expect(extractDirector([])).toBeNull();
  });
});

describe('TmdbProvider (HTTP)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('requests /3/search/movie with the query and, when present, primary_release_year', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ results: [] }));

    await makeProvider().search('9', 2009);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('https://api.themoviedb.org/3/search/movie?');
    expect(url).toContain('query=9');
    expect(url).toContain('primary_release_year=2009');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
  });

  it('omits primary_release_year when no year hint is provided', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ results: [] }));

    await makeProvider().search('Avatar', null);

    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    expect(url).not.toContain('primary_release_year');
  });

  it('returns the real search results array on success', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ results: [PIRATES_TMDB] }));

    const results = await makeProvider().search("Pirates of the Caribbean: At World's End", null);

    expect(results).toEqual([PIRATES_TMDB]);
  });

  it('requests /3/movie/{id}?append_to_response=credits and normalizes the real response shape', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        id: 285,
        title: "Pirates of the Caribbean: At World's End",
        release_date: '2007-05-19',
        runtime: 169,
        overview: 'After losing Captain Jack Sparrow...',
        poster_path: '/jGWpG4YhpQwVmjyHEGkxEkeRf0S.jpg',
        production_countries: [{ iso_3166_1: 'US', name: 'United States of America' }],
        credits: {
          crew: [
            { name: 'Gore Verbinski', job: 'Director' },
            { name: 'Jerry Bruckheimer', job: 'Producer' },
          ],
        },
      }),
    );

    const movie = await makeProvider().getDetails(285);

    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    expect(url).toBe('https://api.themoviedb.org/3/movie/285?append_to_response=credits');
    expect(movie).toEqual({
      id: 285,
      title: "Pirates of the Caribbean: At World's End",
      overview: 'After losing Captain Jack Sparrow...',
      releaseYear: 2007,
      runtime: 169,
      director: 'Gore Verbinski',
      countryCodes: ['US'],
      posterUrl: 'https://image.tmdb.org/t/p/w500/jGWpG4YhpQwVmjyHEGkxEkeRf0S.jpg',
    });
  });

  it('handles a real multi-country production (Avatar: US + GB)', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        id: 19995,
        title: 'Avatar',
        release_date: '2009-12-16',
        runtime: 162,
        production_countries: [
          { iso_3166_1: 'US', name: 'United States of America' },
          { iso_3166_1: 'GB', name: 'United Kingdom' },
        ],
        credits: { crew: [{ name: 'James Cameron', job: 'Director' }] },
      }),
    );

    const movie = await makeProvider().getDetails(19995);

    expect(movie.countryCodes).toEqual(['US', 'GB']);
    expect(movie.director).toBe('James Cameron');
  });

  it('filters out a production country code TMDB returns that is not a recognized ISO 3166-1 alpha-2 code', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        id: 1,
        production_countries: [{ iso_3166_1: 'XX', name: 'Unknown' }],
        credits: { crew: [] },
      }),
    );

    const movie = await makeProvider().getDetails(1);

    expect(movie.countryCodes).toEqual([]);
  });

  it('returns a null poster when poster_path is absent', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ id: 1, credits: { crew: [] } }));

    const movie = await makeProvider().getDetails(1);

    expect(movie.posterUrl).toBeNull();
  });

  it('throws a BarcodeProviderError on 401 (matches the real TMDB error shape)', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          status_code: 7,
          status_message: 'Invalid API key: You must be granted a valid key.',
          success: false,
        },
        false,
        401,
      ),
    );

    await expect(makeProvider().search('test', null)).rejects.toBeInstanceOf(BarcodeProviderError);
  });

  it('throws a BarcodeProviderError immediately when TMDB_READ_ACCESS_TOKEN is not configured', async () => {
    global.fetch = jest.fn();
    const provider = new TmdbProvider(
      { get: () => undefined } as unknown as ConfigService,
      passthroughRateLimiter(),
    );

    await expect(provider.search('test', null)).rejects.toBeInstanceOf(BarcodeProviderError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('retries once on 429 — contrary to UPCitemdb, TMDB documents no daily quota to preserve', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status_code: 25 }, false, 429))
      .mockResolvedValueOnce(jsonResponse({ results: [] }));

    const results = await makeProvider().search('test', null);

    expect(results).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('retries once on a 5xx, then succeeds', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, false, 503))
      .mockResolvedValueOnce(jsonResponse({ results: [] }));

    await makeProvider().search('test', null);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws a BarcodeProviderError after exhausting both attempts on a persistent 429', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, false, 429));

    await expect(makeProvider().search('test', null)).rejects.toBeInstanceOf(BarcodeProviderError);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('retries once on a network failure/timeout, then succeeds', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonResponse({ results: [] }));

    await makeProvider().search('test', null);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws a BarcodeProviderError after exhausting both attempts on a persistent timeout', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    global.fetch = jest.fn().mockRejectedValue(abortError);

    await expect(makeProvider().search('test', null)).rejects.toBeInstanceOf(BarcodeProviderError);
  });

  it('throws a BarcodeProviderError on an unparseable body — never a crash', async () => {
    global.fetch = jest.fn().mockResolvedValue(unparseableResponse(true, 200));

    await expect(makeProvider().search('test', null)).rejects.toBeInstanceOf(BarcodeProviderError);
  });

  it('schedules every attempt through the rate limiter', async () => {
    const schedule = jest.fn((task: () => unknown) => task());
    const rateLimiter = { schedule } as unknown as TmdbRateLimiterService;
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, false, 503))
      .mockResolvedValueOnce(jsonResponse({ results: [] }));

    await new TmdbProvider(fakeConfigService(), rateLimiter).search('test', null);

    expect(schedule).toHaveBeenCalledTimes(2);
  });
});
