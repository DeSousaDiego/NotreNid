import type { ConfigService } from '@nestjs/config';

import { BarcodeProviderError } from './barcode-provider.error';
import { CoverArtArchiveProvider } from './cover-art-archive.provider';
import type { MusicBrainzRateLimiterService } from './musicbrainz-rate-limiter.service';
import {
  MusicBrainzProvider,
  selectBestRelease,
  type MusicBrainzRelease,
} from './musicbrainz.provider';

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

/** Distingue les appels vers musicbrainz.org de ceux vers coverartarchive.org
 * — mêmes providers réels (`MusicBrainzProvider` + `CoverArtArchiveProvider`
 * composé à l'intérieur), un seul `global.fetch` mocké, comme le fait déjà
 * `book-barcode-resolver.service.spec.ts` pour Google Books/Open Library. */
function fetchRouter(handlers: {
  musicbrainz?: () => Promise<Response> | Response;
  coverArt?: () => Promise<Response> | Response;
}): jest.Mock {
  // `async` garantit que l'implémentation renvoie toujours une vraie Promise
  // (donc un objet exposant `.finally`), même quand un handler renvoie une
  // `Response` factice construite de façon synchrone (voir `jsonResponse`).
  return jest.fn(async (url: string) => {
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

function makeProvider(configValues: Record<string, unknown> = {}) {
  return new MusicBrainzProvider(
    fakeConfigService(configValues),
    passthroughRateLimiter(),
    new CoverArtArchiveProvider(fakeConfigService(configValues)),
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
      cd: { artist: 'Daft Punk', releaseYear: 2001, label: 'Daft Life', format: 'Jewel Case' },
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
      cd: { artist: null, releaseYear: null, label: null, format: null },
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
    ).lookup('5099969236424');

    expect(schedule).toHaveBeenCalledTimes(2);
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
