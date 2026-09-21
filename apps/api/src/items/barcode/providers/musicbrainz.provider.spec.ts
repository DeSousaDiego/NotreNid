import type { ConfigService } from '@nestjs/config';

import { BarcodeProviderError } from './barcode-provider.error';
import { CoverArtArchiveProvider } from './cover-art-archive.provider';
import { MusicBrainzArtistCacheService } from './musicbrainz-artist-cache.service';
import type { MusicBrainzRateLimiterService } from './musicbrainz-rate-limiter.service';
import {
  MusicBrainzProvider,
  extractArtistCountry,
  resolveMainArtistMbid,
  selectBestRelease,
  type MusicBrainzRelease,
} from './musicbrainz.provider';

// MBID réel de l'artiste spécial "Various Artists" de MusicBrainz (compilations),
// vérifié par un appel réel le 2026-09-21 — voir `musicbrainz.provider.ts`.
const VARIOUS_ARTISTS_MBID = '89ad4ac3-39f7-470e-963a-56509c546377';

function fakeConfigService(values: Record<string, unknown> = {}): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

/** File d'attente factice — exécute la tâche immédiatement, sans imposer le
 * moindre espacement. Le vrai rythme (~1 req/s) est testé isolément dans
 * `musicbrainz-rate-limiter.service.spec.ts` ; le mélanger ici ralentirait
 * inutilement chaque test de ce fichier. */
function passthroughRateLimiter(): MusicBrainzRateLimiterService {
  return { schedule: (task: () => unknown) => task() } as unknown as MusicBrainzRateLimiterService;
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: () => Promise.resolve(body) } as unknown as Response;
}

/** Distingue les appels vers musicbrainz.org (recherche release VS lookup
 * artiste — même hôte, chemins différents) de ceux vers coverartarchive.org —
 * mêmes providers réels (`MusicBrainzProvider` + `CoverArtArchiveProvider`
 * composé à l'intérieur), un seul `global.fetch` mocké, comme le fait déjà
 * `book-barcode-resolver.service.spec.ts` pour Google Books/Open Library. */
function fetchRouter(handlers: {
  musicbrainz?: () => Promise<Response> | Response;
  musicbrainzArtist?: () => Promise<Response> | Response;
  coverArt?: () => Promise<Response> | Response;
}): jest.Mock {
  // `async` garantit que l'implémentation renvoie toujours une vraie Promise
  // (donc un objet exposant `.finally`), même quand un handler renvoie une
  // `Response` factice construite de façon synchrone (voir `jsonResponse`).
  return jest.fn(async (url: string) => {
    if (url.includes('musicbrainz.org/ws/2/artist/')) {
      if (handlers.musicbrainzArtist) return handlers.musicbrainzArtist();
      throw new Error('unexpected musicbrainz artist call');
    }
    if (url.includes('musicbrainz.org')) {
      if (handlers.musicbrainz) return handlers.musicbrainz();
      throw new Error('unexpected musicbrainz.org call');
    }
    if (url.includes('coverartarchive.org')) {
      if (handlers.coverArt) return handlers.coverArt();
      throw new Error('unexpected coverartarchive.org call');
    }
    throw new Error(`unexpected fetch to ${url}`);
  });
}

const RELEASE: MusicBrainzRelease = {
  id: 'release-mbid-1',
  score: 100,
  title: 'Discovery',
  status: 'Official',
  date: '2001-03-12',
  country: 'FR',
  barcode: '5099969236424',
  packaging: 'Jewel Case',
  'label-info': [{ label: { name: 'Daft Life' } }],
  media: [{ format: 'CD' }],
  'artist-credit': [{ name: 'Daft Punk' }],
};

function searchResponse(releases: MusicBrainzRelease[]): Response {
  return jsonResponse({ count: releases.length, releases });
}

function coverArtResponse(images: unknown[]): Response {
  return jsonResponse({ images });
}

function makeProvider(
  configValues: Record<string, unknown> = {},
  artistCache: MusicBrainzArtistCacheService = new MusicBrainzArtistCacheService(),
) {
  return new MusicBrainzProvider(
    fakeConfigService(configValues),
    passthroughRateLimiter(),
    new CoverArtArchiveProvider(fakeConfigService(configValues)),
    artistCache,
  );
}

describe('MusicBrainzProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('requests the release search endpoint with the barcode query, fmt=json and the required inc list', async () => {
    global.fetch = fetchRouter({ musicbrainz: () => searchResponse([]) });

    await makeProvider().lookup('5099969236424');

    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    expect(url).toContain('https://musicbrainz.org/ws/2/release/');
    expect(url).toContain('query=barcode%3A5099969236424');
    expect(url).toContain('fmt=json');
    expect(url).toContain('inc=labels+media+artist-credits');
  });

  it('sends a descriptive User-Agent header, defaulting when not configured', async () => {
    global.fetch = fetchRouter({ musicbrainz: () => searchResponse([]) });

    await makeProvider().lookup('5099969236424');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['User-Agent']).toMatch(/^NotreNid\/.+\(.+\)$/);
  });

  it('sends the configured User-Agent when MUSICBRAINZ_USER_AGENT is set', async () => {
    global.fetch = fetchRouter({ musicbrainz: () => searchResponse([]) });

    await makeProvider({ MUSICBRAINZ_USER_AGENT: 'Test/1.0 (test@example.test)' }).lookup(
      '5099969236424',
    );

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['User-Agent']).toBe(
      'Test/1.0 (test@example.test)',
    );
  });

  it('maps a full match into the normalized shape, cover included', async () => {
    global.fetch = fetchRouter({
      musicbrainz: () => searchResponse([RELEASE]),
      coverArt: () =>
        coverArtResponse([
          { front: true, thumbnails: { large: 'https://example.test/cover-large.jpg' } },
        ]),
    });

    const result = await makeProvider().lookup('5099969236424');

    expect(result).toEqual({
      title: 'Discovery',
      // `format` vient de `release.packaging` ("Jewel Case"), jamais de
      // `media[0].format` ("CD", ignoré) — voir docs/DECISIONS.md.
      // `artistCountry` reste `null` : `RELEASE['artist-credit']` n'expose
      // aucun `artist.id`, donc aucun appel artiste n'est tenté.
      cd: {
        artist: 'Daft Punk',
        releaseYear: 2001,
        label: 'Daft Life',
        format: 'Jewel Case',
        artistCountry: null,
      },
      coverUrl: 'https://example.test/cover-large.jpg',
    });
  });

  it('prefills cd.format from release.packaging when present', async () => {
    const release: MusicBrainzRelease = { ...RELEASE, packaging: 'Digipak' };
    global.fetch = fetchRouter({
      musicbrainz: () => searchResponse([release]),
      coverArt: () => jsonResponse({}, false, 404),
    });

    const result = await makeProvider().lookup('5099969236424');

    expect(result?.cd.format).toBe('Digipak');
  });

  it('leaves cd.format null when packaging is absent, even when media[].format is present', async () => {
    const release: MusicBrainzRelease = { ...RELEASE, packaging: undefined };
    global.fetch = fetchRouter({
      musicbrainz: () => searchResponse([release]),
      coverArt: () => jsonResponse({}, false, 404),
    });

    const result = await makeProvider().lookup('5099969236424');

    // `release.media` (le support "CD") reste présent dans ce fixture mais ne
    // doit plus jamais alimenter `cd.format` (le boîtier) — voir docs/DECISIONS.md.
    expect(release.media?.[0]?.format).toBe('CD');
    expect(result?.cd.format).toBeNull();
  });

  it('maps a real MusicBrainz search response (barcode 075992537926, captured 2026-09-21) without a second release lookup', async () => {
    // Réponse réelle de `GET /ws/2/release/?query=barcode:075992537926&fmt=json&inc=labels+media+artist-credits`
    // (release retenue uniquement, champs non lus par le mapping omis). `packaging`
    // ("Jewel Case") est bien un champ de base de la réponse de RECHERCHE, identique à
    // celui renvoyé par `GET /ws/2/release/{mbid}?...` (détail) pour la même release —
    // vérifié par un second appel réel le même jour. Aucun second appel MusicBrainz
    // n'est donc nécessaire ni permis pour renseigner `cd.format` — voir docs/DECISIONS.md.
    const diamondsAndPearls: MusicBrainzRelease = {
      id: 'a314ca50-8385-44f9-ab1b-8bb8532b88f3',
      score: 100,
      title: 'Diamonds and Pearls',
      status: 'Official',
      date: '1991-09',
      country: 'FR',
      barcode: '075992537926',
      packaging: 'Jewel Case',
      'label-info': [
        { label: { name: 'Paisley Park' } },
        {},
        {},
        { label: { name: 'Warner Bros. Records' } },
      ],
      media: [{ format: 'CD' }],
      // MBID réels (vérifiés par le même appel réel) : deux `artist-credit`,
      // chacun avec un `artist.id` valide — prouve que `artistCountry` reste
      // `null` à cause de l'AMBIGUÏTÉ (2 crédits), pas d'un simple MBID
      // manquant (voir `resolveMainArtistMbid`).
      'artist-credit': [
        {
          name: 'Prince',
          joinphrase: ' & ',
          artist: { id: '070d193a-845c-479f-980e-bef15710653e', name: 'Prince' },
        },
        {
          name: 'The New Power Generation',
          artist: { id: '51d63176-56e8-45b9-88e3-81e6436473f3', name: 'The New Power Generation' },
        },
      ],
    };
    global.fetch = fetchRouter({
      musicbrainz: () => searchResponse([diamondsAndPearls]),
      coverArt: () => jsonResponse({}, false, 404),
    });

    const result = await makeProvider().lookup('075992537926');

    // La régression observée en production (Render) renvoyait `"format": "CD"` —
    // c'est `media[0].format` ("CD", le support), jamais la valeur attendue ici.
    expect(result?.cd.format).toBe('Jewel Case');
    expect(result?.cd.format).not.toBe('CD');
    expect(result).toEqual({
      title: 'Diamonds and Pearls',
      cd: {
        artist: 'Prince & The New Power Generation',
        releaseYear: 1991,
        label: 'Paisley Park',
        format: 'Jewel Case',
        // Jamais Prince (ni personne d'autre) choisi arbitrairement parmi les
        // deux crédits — voir `resolveMainArtistMbid`.
        artistCountry: null,
      },
      coverUrl: null,
    });
    // Une seule requête vers musicbrainz.org (la recherche) : jamais de second appel
    // par MBID pour obtenir `packaging`, qui serait déjà présent dans la recherche —
    // un second appel doublerait le budget de débit (~1 req/s) pour rien. Et aucun
    // appel `/ws/2/artist/` : la logique s'arrête avant, sur l'ambiguïté des crédits.
    const musicBrainzCalls = (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
      (url as string).includes('musicbrainz.org'),
    );
    expect(musicBrainzCalls).toHaveLength(1);
  });

  it('joins multiple artist credits using the joinphrase MusicBrainz provides, never a generic separator', async () => {
    const release: MusicBrainzRelease = {
      ...RELEASE,
      'artist-credit': [
        { name: 'Artist A', joinphrase: ' feat. ' },
        { name: 'Artist B', joinphrase: '' },
      ],
    };
    global.fetch = fetchRouter({
      musicbrainz: () => searchResponse([release]),
      coverArt: () => jsonResponse({}, false, 404),
    });

    const result = await makeProvider().lookup('5099969236424');

    expect(result?.cd.artist).toBe('Artist A feat. Artist B');
  });

  it('extracts a 4-digit year from an imprecise date', async () => {
    const release: MusicBrainzRelease = { ...RELEASE, date: '2001' };
    global.fetch = fetchRouter({
      musicbrainz: () => searchResponse([release]),
      coverArt: () => jsonResponse({}, false, 404),
    });

    const result = await makeProvider().lookup('5099969236424');

    expect(result?.cd.releaseYear).toBe(2001);
  });

  it('leaves fields null when MusicBrainz does not provide them, never inventing a value', async () => {
    const release: MusicBrainzRelease = {
      id: 'release-mbid-2',
      barcode: '5099969236424',
    };
    global.fetch = fetchRouter({
      musicbrainz: () => searchResponse([release]),
      coverArt: () => jsonResponse({}, false, 404),
    });

    const result = await makeProvider().lookup('5099969236424');

    expect(result).toEqual({
      title: null,
      cd: { artist: null, releaseYear: null, label: null, format: null, artistCountry: null },
      coverUrl: null,
    });
  });

  it('returns null when no release is found (no_match, not an error)', async () => {
    global.fetch = fetchRouter({ musicbrainz: () => searchResponse([]) });

    expect(await makeProvider().lookup('5099969236424')).toBeNull();
  });

  it('returns null when every returned release has a different barcode than requested (no fuzzy fallback)', async () => {
    const release: MusicBrainzRelease = { ...RELEASE, barcode: '0000000000000' };
    global.fetch = fetchRouter({ musicbrainz: () => searchResponse([release]) });

    expect(await makeProvider().lookup('5099969236424')).toBeNull();
  });

  it('never lets a Cover Art Archive failure turn a valid match into a provider_error', async () => {
    global.fetch = fetchRouter({
      musicbrainz: () => searchResponse([RELEASE]),
      coverArt: () => Promise.reject(new Error('cover art down')),
    });

    const result = await makeProvider().lookup('5099969236424');

    expect(result?.title).toBe('Discovery');
    expect(result?.coverUrl).toBeNull();
  });

  it('returns a null coverUrl (not an error) when Cover Art Archive has no front image (404)', async () => {
    global.fetch = fetchRouter({
      musicbrainz: () => searchResponse([RELEASE]),
      coverArt: () => jsonResponse({}, false, 404),
    });

    const result = await makeProvider().lookup('5099969236424');

    expect(result?.coverUrl).toBeNull();
  });

  it('throws a BarcodeProviderError on a non-retryable HTTP status (400), without retrying', async () => {
    global.fetch = fetchRouter({ musicbrainz: () => jsonResponse({}, false, 400) });

    await expect(makeProvider().lookup('5099969236424')).rejects.toBeInstanceOf(
      BarcodeProviderError,
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries once on a 503 (rate limit exceeded), then succeeds', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, false, 503))
      .mockResolvedValueOnce(searchResponse([RELEASE]))
      .mockResolvedValueOnce(jsonResponse({}, false, 404));

    const result = await makeProvider().lookup('5099969236424');

    expect(result?.title).toBe('Discovery');
    // 2 appels musicbrainz.org (échec puis succès) + 1 appel coverartarchive.org.
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('retries once on a network failure, then succeeds', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(searchResponse([]));

    expect(await makeProvider().lookup('5099969236424')).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws a BarcodeProviderError after exhausting both attempts on a persistent 429', async () => {
    global.fetch = fetchRouter({ musicbrainz: () => jsonResponse({}, false, 429) });

    await expect(makeProvider().lookup('5099969236424')).rejects.toBeInstanceOf(
      BarcodeProviderError,
    );
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('schedules every musicbrainz.org attempt (including retries) through the rate limiter', async () => {
    const schedule = jest.fn((task: () => unknown) => task());
    const rateLimiter = { schedule } as unknown as MusicBrainzRateLimiterService;
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, false, 503))
      .mockResolvedValueOnce(searchResponse([]));

    await new MusicBrainzProvider(
      fakeConfigService(),
      rateLimiter,
      new CoverArtArchiveProvider(fakeConfigService()),
      new MusicBrainzArtistCacheService(),
    ).lookup('5099969236424');

    expect(schedule).toHaveBeenCalledTimes(2);
  });

  describe('cd.artistCountry', () => {
    const ARTIST_MBID = '070d193a-845c-479f-980e-bef15710653e';
    const SINGLE_ARTIST_RELEASE: MusicBrainzRelease = {
      ...RELEASE,
      'artist-credit': [{ name: 'Daft Punk', artist: { id: ARTIST_MBID, name: 'Daft Punk' } }],
    };

    it("fills cd.artistCountry from the main artist's country when exactly one unambiguous artist-credit is present", async () => {
      global.fetch = fetchRouter({
        musicbrainz: () => searchResponse([SINGLE_ARTIST_RELEASE]),
        musicbrainzArtist: () => jsonResponse({ id: ARTIST_MBID, country: 'US' }),
        coverArt: () => jsonResponse({}, false, 404),
      });

      const result = await makeProvider().lookup('5099969236424');

      expect(result?.cd.artistCountry).toBe('US');
      const [artistUrl] = (global.fetch as jest.Mock).mock.calls.find(([url]) =>
        (url as string).includes('/ws/2/artist/'),
      ) as [string];
      expect(artistUrl).toBe(`https://musicbrainz.org/ws/2/artist/${ARTIST_MBID}?fmt=json`);
    });

    it('leaves cd.artistCountry null when the artist has neither country nor area data', async () => {
      global.fetch = fetchRouter({
        musicbrainz: () => searchResponse([SINGLE_ARTIST_RELEASE]),
        musicbrainzArtist: () => jsonResponse({ id: ARTIST_MBID }),
        coverArt: () => jsonResponse({}, false, 404),
      });

      const result = await makeProvider().lookup('5099969236424');

      expect(result?.cd.artistCountry).toBeNull();
    });

    it('falls back to area["iso-3166-1-codes"] when country is absent, never to begin-area', async () => {
      global.fetch = fetchRouter({
        musicbrainz: () => searchResponse([SINGLE_ARTIST_RELEASE]),
        musicbrainzArtist: () =>
          jsonResponse({
            id: ARTIST_MBID,
            area: { 'iso-3166-1-codes': ['GB'] },
            // Présente dans une vraie réponse MusicBrainz (lieu de
            // naissance/formation, souvent une ville) — jamais lue par
            // `extractArtistCountry`, même avec des codes différents ici.
            'begin-area': { name: 'Minneapolis', 'iso-3166-1-codes': ['US'] },
          }),
        coverArt: () => jsonResponse({}, false, 404),
      });

      const result = await makeProvider().lookup('5099969236424');

      expect(result?.cd.artistCountry).toBe('GB');
    });

    it('leaves cd.artistCountry null when the artist call fails outright — the CD result stays matched', async () => {
      global.fetch = fetchRouter({
        musicbrainz: () => searchResponse([SINGLE_ARTIST_RELEASE]),
        musicbrainzArtist: () => Promise.reject(new Error('network down')),
        coverArt: () => jsonResponse({}, false, 404),
      });

      const result = await makeProvider().lookup('5099969236424');

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Discovery');
      expect(result?.cd.artistCountry).toBeNull();
    });

    it('leaves cd.artistCountry null on a timeout from the artist endpoint — the CD result stays matched', async () => {
      const abortError = new Error('aborted');
      abortError.name = 'AbortError';
      global.fetch = fetchRouter({
        musicbrainz: () => searchResponse([SINGLE_ARTIST_RELEASE]),
        musicbrainzArtist: () => Promise.reject(abortError),
        coverArt: () => jsonResponse({}, false, 404),
      });

      const result = await makeProvider().lookup('5099969236424');

      expect(result).not.toBeNull();
      expect(result?.cd.artistCountry).toBeNull();
    });

    it('leaves cd.artistCountry null on 429/503 from the artist endpoint — non-blocking, never retried', async () => {
      global.fetch = fetchRouter({
        musicbrainz: () => searchResponse([SINGLE_ARTIST_RELEASE]),
        musicbrainzArtist: () => jsonResponse({}, false, 503),
        coverArt: () => jsonResponse({}, false, 404),
      });

      const result = await makeProvider().lookup('5099969236424');

      expect(result?.cd.artistCountry).toBeNull();
      const artistCalls = (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
        (url as string).includes('/ws/2/artist/'),
      );
      // Une seule tentative : contrairement à la recherche release, cet appel
      // n'est jamais retenté (best-effort, non bloquant).
      expect(artistCalls).toHaveLength(1);
    });

    it('leaves cd.artistCountry null when several artist-credit entries are present, even if every one has a valid MBID', async () => {
      const release: MusicBrainzRelease = {
        ...RELEASE,
        'artist-credit': [
          { name: 'Artist A', joinphrase: ' & ', artist: { id: 'mbid-a', name: 'Artist A' } },
          { name: 'Artist B', artist: { id: 'mbid-b', name: 'Artist B' } },
        ],
      };
      global.fetch = fetchRouter({
        musicbrainz: () => searchResponse([release]),
        coverArt: () => jsonResponse({}, false, 404),
      });

      const result = await makeProvider().lookup('5099969236424');

      expect(result?.cd.artistCountry).toBeNull();
      const artistCalls = (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
        (url as string).includes('/ws/2/artist/'),
      );
      expect(artistCalls).toHaveLength(0);
    });

    it('leaves cd.artistCountry null for the "Various Artists" special-purpose artist, never a guessed country', async () => {
      const release: MusicBrainzRelease = {
        ...RELEASE,
        'artist-credit': [
          {
            name: 'Various Artists',
            artist: { id: VARIOUS_ARTISTS_MBID, name: 'Various Artists' },
          },
        ],
      };
      global.fetch = fetchRouter({
        musicbrainz: () => searchResponse([release]),
        coverArt: () => jsonResponse({}, false, 404),
      });

      const result = await makeProvider().lookup('5099969236424');

      expect(result?.cd.artistCountry).toBeNull();
      const artistCalls = (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
        (url as string).includes('/ws/2/artist/'),
      );
      expect(artistCalls).toHaveLength(0);
    });

    it('schedules the artist lookup through the same MusicBrainzRateLimiterService as the release search', async () => {
      const schedule = jest.fn((task: () => unknown) => task());
      const rateLimiter = { schedule } as unknown as MusicBrainzRateLimiterService;
      global.fetch = fetchRouter({
        musicbrainz: () => searchResponse([SINGLE_ARTIST_RELEASE]),
        musicbrainzArtist: () => jsonResponse({ id: ARTIST_MBID, country: 'US' }),
        coverArt: () => jsonResponse({}, false, 404),
      });

      await new MusicBrainzProvider(
        fakeConfigService(),
        rateLimiter,
        new CoverArtArchiveProvider(fakeConfigService()),
        new MusicBrainzArtistCacheService(),
      ).lookup('5099969236424');

      // 1 recherche release + 1 lookup artiste, toutes deux via le même limiteur
      // (la couverture, hôte distinct, ne passe jamais par ce rate limiter).
      expect(schedule).toHaveBeenCalledTimes(2);
    });

    it('a cache hit avoids a second artist HTTP call — even for a different CD by the same artist', async () => {
      const sharedArtistCache = new MusicBrainzArtistCacheService();
      const otherRelease: MusicBrainzRelease = {
        ...SINGLE_ARTIST_RELEASE,
        id: 'release-mbid-other',
        barcode: '0000000012345',
        title: 'Homework',
      };
      const musicbrainzSearchHandler = jest
        .fn()
        .mockReturnValueOnce(searchResponse([SINGLE_ARTIST_RELEASE]))
        .mockReturnValueOnce(searchResponse([otherRelease]));
      global.fetch = fetchRouter({
        musicbrainz: musicbrainzSearchHandler,
        musicbrainzArtist: () => jsonResponse({ id: ARTIST_MBID, country: 'US' }),
        coverArt: () => jsonResponse({}, false, 404),
      });

      const first = await makeProvider({}, sharedArtistCache).lookup('5099969236424');
      const second = await makeProvider({}, sharedArtistCache).lookup('0000000012345');

      expect(first?.cd.artistCountry).toBe('US');
      expect(second?.cd.artistCountry).toBe('US');
      const artistCalls = (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
        (url as string).includes('/ws/2/artist/'),
      );
      expect(artistCalls).toHaveLength(1);
    });
  });
});

describe('resolveMainArtistMbid', () => {
  it('returns the MBID when exactly one artist-credit exposes one', () => {
    expect(
      resolveMainArtistMbid([{ name: 'Daft Punk', artist: { id: 'mbid-1', name: 'Daft Punk' } }]),
    ).toBe('mbid-1');
  });

  it('returns null when there is no artist-credit at all', () => {
    expect(resolveMainArtistMbid(undefined)).toBeNull();
    expect(resolveMainArtistMbid([])).toBeNull();
  });

  it('returns null when the single artist-credit has no artist.id', () => {
    expect(resolveMainArtistMbid([{ name: 'Daft Punk' }])).toBeNull();
  });

  it('returns null when there are two or more artist-credit entries, never guessing which one', () => {
    expect(
      resolveMainArtistMbid([
        { name: 'Artist A', artist: { id: 'mbid-a' } },
        { name: 'Artist B', artist: { id: 'mbid-b' } },
      ]),
    ).toBeNull();
  });

  it('returns null for the "Various Artists" special-purpose MBID', () => {
    expect(
      resolveMainArtistMbid([
        { name: 'Various Artists', artist: { id: VARIOUS_ARTISTS_MBID, name: 'Various Artists' } },
      ]),
    ).toBeNull();
  });
});

describe('extractArtistCountry', () => {
  it('uses artist.country when present', () => {
    expect(extractArtistCountry({ country: 'US' })).toBe('US');
  });

  it('falls back to area["iso-3166-1-codes"][0] when country is absent', () => {
    expect(extractArtistCountry({ area: { 'iso-3166-1-codes': ['GB', 'IE'] } })).toBe('GB');
  });

  it('prefers country over area when both are present', () => {
    expect(extractArtistCountry({ country: 'US', area: { 'iso-3166-1-codes': ['GB'] } })).toBe(
      'US',
    );
  });

  it('returns null when neither country nor a usable area is present', () => {
    expect(extractArtistCountry({})).toBeNull();
    expect(extractArtistCountry({ area: {} })).toBeNull();
    expect(extractArtistCountry({ area: { 'iso-3166-1-codes': [] } })).toBeNull();
  });
});

describe('selectBestRelease', () => {
  it('keeps only releases whose barcode matches exactly', () => {
    const releases: MusicBrainzRelease[] = [
      { id: 'a', barcode: '0000000000000' },
      { id: 'b', barcode: '5099969236424' },
    ];
    expect(selectBestRelease(releases, '5099969236424')?.id).toBe('b');
  });

  it('returns null when no release matches the barcode exactly', () => {
    const releases: MusicBrainzRelease[] = [{ id: 'a', barcode: '0000000000000' }];
    expect(selectBestRelease(releases, '5099969236424')).toBeNull();
  });

  it('prefers an Official release over any other status', () => {
    const releases: MusicBrainzRelease[] = [
      { id: 'bootleg', barcode: '123', status: 'Bootleg', date: '2001', country: 'FR' },
      { id: 'official', barcode: '123', status: 'Official' },
    ];
    expect(selectBestRelease(releases, '123')?.id).toBe('official');
  });

  it('prefers the most complete release among releases sharing the same status', () => {
    const releases: MusicBrainzRelease[] = [
      { id: 'bare', barcode: '123', status: 'Official' },
      {
        id: 'complete',
        barcode: '123',
        status: 'Official',
        date: '2001',
        country: 'FR',
        'label-info': [{ label: { name: 'Daft Life' } }],
        media: [{ format: 'CD' }],
      },
    ];
    expect(selectBestRelease(releases, '123')?.id).toBe('complete');
  });

  it('keeps the provider’s own order as a stable tie-break when completeness is equal', () => {
    const releases: MusicBrainzRelease[] = [
      { id: 'first', barcode: '123', status: 'Official' },
      { id: 'second', barcode: '123', status: 'Official' },
    ];
    expect(selectBestRelease(releases, '123')?.id).toBe('first');
  });
});
