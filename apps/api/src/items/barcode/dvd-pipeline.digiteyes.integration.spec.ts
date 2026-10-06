import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { BarcodeCacheService } from './barcode-cache.service';
import { DvdBarcodeResolverService } from './dvd-barcode-resolver.service';
import { DvdEnrichmentService } from './dvd-enrichment.service';
import { ProductImageValidator } from './product-image-validator.service';
import { DigitEyesProvider } from './providers/digit-eyes.provider';
import type { TmdbProvider, TmdbSearchResult } from './providers/tmdb.provider';
import {
  DIGITEYES_AVATAR,
  DIGITEYES_CHEERIOS,
  DIGITEYES_DARK_KNIGHT_TRILOGY,
  DIGITEYES_NINE_BLURAY,
  DIGITEYES_PIRATES,
  type DigitEyesFixture,
} from './test-fixtures/digiteyes';
import {
  AVATAR_TMDB_DETAILS,
  AVATAR_TMDB_SEARCH_RESULTS,
  DARK_KNIGHT_TRILOGY_TMDB_SEARCH_RESULTS,
  NINE_TMDB_DETAILS,
  NINE_TMDB_SEARCH_RESULTS,
  PIRATES_TMDB_DETAILS,
  PIRATES_TMDB_SEARCH_RESULTS,
} from './test-fixtures/tmdb';

/**
 * Pipeline `dvd` complet avec Digit-Eyes — VRAI `DigitEyesProvider` (signature,
 * requête, décodage, classification), VRAI `DvdEnrichmentService` (nettoyage de
 * titre, extraction d'année, scoring TMDB réel), VRAIE `BarcodeCacheService`.
 * Seuls le réseau Digit-Eyes (`fetch`, réponses réelles du POC du 2026-10-06,
 * voir `test-fixtures/digiteyes/`) et TMDB (`search`/`getDetails`, fixtures
 * existantes) sont simulés : aucune requête facturée, aucun secret réel.
 */
const CONFIG = {
  get: (key: string) => ({ DIGITEYES_APP_KEY: 'test-app', DIGITEYES_AUTH_KEY: 'test-auth' })[key],
} as unknown as ConfigService;

const FIXTURES: DigitEyesFixture[] = [
  DIGITEYES_NINE_BLURAY,
  DIGITEYES_DARK_KNIGHT_TRILOGY,
  DIGITEYES_PIRATES,
  DIGITEYES_AVATAR,
  DIGITEYES_CHEERIOS,
];

/** Accessibilité réelle des images observée au POC : seule celle de Dark
 * Knight répondait (eBay 404, domaine Azure mort, Cheerios en http://). */
const POC_IMAGE_REACHABILITY = {
  isUsable: (url: string | null) =>
    Promise.resolve(url === DIGITEYES_DARK_KNIGHT_TRILOGY.response.image),
} as unknown as ProductImageValidator;

function fakeTmdb(search: jest.Mock, getDetails: jest.Mock): TmdbProvider {
  return { id: 'tmdb', search, getDetails } as unknown as TmdbProvider;
}

describe('dvd pipeline with Digit-Eyes (integration, no network)', () => {
  const originalFetch = global.fetch;
  let digitEyesCalls: number;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    digitEyesCalls = 0;
    global.fetch = jest.fn((input: string | URL) => {
      const url = new URL(String(input));
      if (url.hostname !== 'www.digit-eyes.com') {
        return Promise.reject(new TypeError('fetch failed'));
      }
      digitEyesCalls += 1;
      const fixture = FIXTURES.find((f) => f.barcode === url.searchParams.get('upc_code'));
      return Promise.resolve(
        fixture
          ? new Response(JSON.stringify(fixture.response), {
              status: 200,
              headers: { 'content-type': 'application/json; charset=ISO-8859-1' },
            })
          : new Response(JSON.stringify({ return_code: '999' }), { status: 404 }),
      );
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function buildResolver(
    tmdbSearch: jest.Mock,
    tmdbGetDetails: jest.Mock,
    imageValidator: ProductImageValidator = POC_IMAGE_REACHABILITY,
  ) {
    return new DvdBarcodeResolverService(
      new DigitEyesProvider(CONFIG),
      new DvdEnrichmentService(fakeTmdb(tmdbSearch, tmdbGetDetails)),
      new BarcodeCacheService(),
      imageValidator,
    );
  }

  it('"9": cleaned to "9" with year 2009, matched to the real film, dead provider image → TMDB poster', async () => {
    const tmdbSearch = jest.fn().mockResolvedValue(NINE_TMDB_SEARCH_RESULTS);
    const tmdbGetDetails = jest.fn().mockResolvedValue(NINE_TMDB_DETAILS);

    const response = await buildResolver(tmdbSearch, tmdbGetDetails).resolve(
      DIGITEYES_NINE_BLURAY.barcode,
    );

    expect(tmdbSearch).toHaveBeenCalledWith('9', 2009);
    expect(response.status).toBe('matched');
    expect(response.source).toBe('digiteyes');
    expect(response.data?.title).toBe('9');
    expect(response.data?.dvd?.region).toBe('region 1');
    expect(response.cover?.url).toBe(NINE_TMDB_DETAILS.posterUrl);
  });

  it('Pirates: "Worlds" (no apostrophe) still matched to the real film #285', async () => {
    const tmdbSearch = jest.fn().mockResolvedValue(PIRATES_TMDB_SEARCH_RESULTS);
    const tmdbGetDetails = jest.fn().mockResolvedValue(PIRATES_TMDB_DETAILS);

    const response = await buildResolver(tmdbSearch, tmdbGetDetails).resolve(
      DIGITEYES_PIRATES.barcode,
    );

    expect(tmdbSearch).toHaveBeenCalledWith('Pirates of the Caribbean: At Worlds End', null);
    expect(tmdbGetDetails).toHaveBeenCalledWith(285);
    expect(response.status).toBe('matched');
    expect(response.data?.dvd?.format).toBe('2-disc');
    // Domaine d'image mort → jamais exposé, poster TMDB à la place.
    expect(response.cover?.url).toBe(PIRATES_TMDB_DETAILS.posterUrl);
  });

  it('Avatar: retailer suffix cleaned, matched, no provider image → TMDB poster', async () => {
    const tmdbSearch = jest.fn().mockResolvedValue(AVATAR_TMDB_SEARCH_RESULTS);
    const tmdbGetDetails = jest.fn().mockResolvedValue(AVATAR_TMDB_DETAILS);

    const response = await buildResolver(tmdbSearch, tmdbGetDetails).resolve(
      DIGITEYES_AVATAR.barcode,
    );

    expect(tmdbSearch).toHaveBeenCalledWith('Avatar', null);
    expect(response.status).toBe('matched');
    expect(response.cover?.url).toBe(AVATAR_TMDB_DETAILS.posterUrl);
  });

  it('Dark Knight Trilogy: recognized as video through categories, stays partial — no single film forced, even with the individual films as candidates', async () => {
    const individualFilms: TmdbSearchResult[] = [
      { id: 155, title: 'The Dark Knight', release_date: '2008-07-16', popularity: 120 },
      { id: 49026, title: 'The Dark Knight Rises', release_date: '2012-07-16', popularity: 90 },
      { id: 272, title: 'Batman Begins', release_date: '2005-06-10', popularity: 80 },
      ...DARK_KNIGHT_TRILOGY_TMDB_SEARCH_RESULTS,
    ];
    const tmdbSearch = jest.fn().mockResolvedValue(individualFilms);
    const tmdbGetDetails = jest.fn();

    const response = await buildResolver(tmdbSearch, tmdbGetDetails).resolve(
      DIGITEYES_DARK_KNIGHT_TRILOGY.barcode,
    );

    expect(tmdbSearch).toHaveBeenCalled();
    expect(tmdbGetDetails).not.toHaveBeenCalled();
    expect(response.status).toBe('partial');
    expect(response.data?.dvd).toEqual({
      director: null,
      releaseYear: null,
      duration: null,
      edition: 'Ultimate Collectors Edition',
      region: null,
      format: null,
    });
    // Seule image du POC réellement accessible : jaquette physique prioritaire.
    expect(response.cover?.url).toBe(DIGITEYES_DARK_KNIGHT_TRILOGY.response.image);
  });

  it('Cheerios: no_match, TMDB never called, no false video positive', async () => {
    const tmdbSearch = jest.fn();

    const response = await buildResolver(tmdbSearch, jest.fn()).resolve(DIGITEYES_CHEERIOS.barcode);

    expect(response.status).toBe('no_match');
    expect(response.data).toBeNull();
    expect(tmdbSearch).not.toHaveBeenCalled();
  });

  it('a failing image check never breaks the resolution (real validator, image host unreachable)', async () => {
    const tmdbSearch = jest.fn().mockResolvedValue(DARK_KNIGHT_TRILOGY_TMDB_SEARCH_RESULTS);

    const response = await buildResolver(
      tmdbSearch,
      jest.fn(),
      new ProductImageValidator({ get: () => undefined } as unknown as ConfigService),
    ).resolve(DIGITEYES_DARK_KNIGHT_TRILOGY.barcode);

    expect(response.status).toBe('partial');
    expect(response.cover).toBeNull();
  });

  it('a Digit-Eyes quota error (402) → provider_error, never cached: the next scan retries', async () => {
    global.fetch = jest.fn(() => {
      digitEyesCalls += 1;
      return Promise.resolve(new Response(JSON.stringify({ return_code: '666' }), { status: 402 }));
    }) as unknown as typeof fetch;
    const resolver = buildResolver(jest.fn(), jest.fn());

    const first = await resolver.resolve(DIGITEYES_PIRATES.barcode);
    await resolver.resolve(DIGITEYES_PIRATES.barcode);

    expect(first.status).toBe('provider_error');
    expect(first.data).toBeNull();
    expect(digitEyesCalls).toBe(2);
  });
});
