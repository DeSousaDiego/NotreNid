import type { ConfigService } from '@nestjs/config';

import { BarcodeProviderError } from './barcode-provider.error';
import type { UpcItemDbRateLimiterService } from './upcitemdb-rate-limiter.service';
import {
  UpcItemDbProvider,
  detectEditionHint,
  detectMediaType,
  detectPackagingHint,
  detectRegionHint,
  selectMatchingItem,
} from './upcitemdb.provider';

function fakeConfigService(values: Record<string, unknown> = {}): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

/** File d'attente factice — exécute la tâche immédiatement, sans imposer le
 * moindre espacement (le vrai rythme ~1/10.5s est testé isolément dans
 * `upcitemdb-rate-limiter.service.spec.ts`). */
function passthroughRateLimiter(): UpcItemDbRateLimiterService {
  return { schedule: (task: () => unknown) => task() } as unknown as UpcItemDbRateLimiterService;
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
  return new UpcItemDbProvider(fakeConfigService(configValues), passthroughRateLimiter());
}

// Fixtures construites à partir de réponses RÉELLES `GET
// https://api.upcitemdb.com/prod/trial/lookup?upc={code}` capturées le
// 2026-09-21 (plan FREE/trial, aucune clé) — voir docs/DECISIONS.md pour le
// détail des 6 appels de vérification. Champs non lus par le mapping omis.

// UPC 786936815481 — DVD+Blu-ray combo réel (Disney).
const PIRATES_ITEM = {
  ean: '0786936815481',
  title: "Pirates of the Caribbean: At World's End (DVD + 2-Disc Blu-ray)",
  description: 'Bloopers of the CaribbeanCrew Confidential',
  upc: '786936815481',
  brand: 'Disney',
  category: 'Electronics > Video > Televisions',
  images: ['https://example.test/pirates-cover.jpg'],
  offers: [{ title: "Pirates of the Caribbean:  At World&'s End" }],
};

// UPC 792266015255 — Blu-ray collector réel, presque tous les champs
// structurés vides sauf `title` (Fox).
const AVATAR_ITEM = {
  ean: '0792266015255',
  title:
    "Avatar (Three-Disc Extended Collector's Edition + BD-Live) [Blu-ray] by 20th Century Fox by James Cameron (B01GWD9VG2)",
  description: '',
  upc: '792266015255',
  brand: '',
  category: '',
  images: [] as string[],
  offers: [] as { title?: string }[],
};

// UPC 883929308002 — Blu-ray boxset réel (Warner Bros.), "6 Discs" présent
// uniquement dans un `offers[].title`, jamais dans le `title` principal.
const DARK_KNIGHT_ITEM = {
  ean: '0883929308002',
  title: 'The Dark Knight Trilogy [Blu-ray]',
  description: 'The Dark Knight Trilogy [Blu-ray]',
  upc: '883929308002',
  brand: 'Warner Bros.',
  category: 'Electronics > Video > Video Players & Recorders > DVD & Blu-ray Players',
  images: ['https://example.test/dark-knight-cover.jpg'],
  offers: [
    { title: "The Dark Knight Trilogy: Ultimate Collector's Edition [Blu-ray]" },
    {
      title: "Dark Knight Trilogy: Ultimate Collector's Edition [6 Discs] [Blu-ray](Blu-ray) (new)",
    },
  ],
};

// UPC 065935831686 — Blu-ray standalone réel, seul cas observé avec une
// `category` correcte-mais-générique ("Media").
const NINE_ITEM = {
  ean: '0065935831686',
  title: '9 (Blu-ray Disc, 2009)',
  description: '9 (Blu-ray) (Bilingual).',
  upc: '065935831686',
  brand: 'Alliance Films',
  category: 'Media',
  images: ['https://example.test/nine-cover.jpg'],
  offers: [{ title: '9' }],
};

// UPC 016000487727 — produit non-vidéo réel (contrôle négatif), catégorie
// alimentaire claire.
const CHEERIOS_ITEM = {
  ean: '0016000487727',
  title: 'Cheerios Cereal',
  description: 'INGREDIENTS: WHOLE GRAIN OATS, CORN STARCH, SUGAR, SALT.',
  upc: '016000487727',
  brand: 'Cheerios',
  category: 'Food, Beverages & Tobacco > Food Items > Grains, Rice & Cereal > Cereal & Granola',
  images: ['https://example.test/cheerios.jpg'],
  offers: [{ title: 'Cheerios Breakfast Cereal - 12oz - General Mills' }],
};

describe('UpcItemDbProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('requests the trial lookup endpoint with the barcode as the upc query param', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ code: 'OK', total: 0, items: [] }));

    await makeProvider().lookup('786936815481');

    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    expect(url).toBe('https://api.upcitemdb.com/prod/trial/lookup?upc=786936815481');
  });

  it('sends a descriptive User-Agent header, defaulting when not configured', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ code: 'OK', total: 0, items: [] }));

    await makeProvider().lookup('786936815481');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['User-Agent']).toMatch(/^NotreNid\/.+\(.+\)$/);
  });

  it('maps a real DVD+Blu-ray combo pack as matched, mediaType "dvd", packagingHint "2-Disc"', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ code: 'OK', total: 1, items: [PIRATES_ITEM] }));

    const outcome = await makeProvider().lookup('786936815481');

    expect(outcome.status).toBe('matched');
    if (outcome.status !== 'matched') throw new Error('unreachable');
    expect(outcome.result).toEqual({
      barcode: '786936815481',
      rawTitle: "Pirates of the Caribbean: At World's End (DVD + 2-Disc Blu-ray)",
      description: 'Bloopers of the CaribbeanCrew Confidential',
      brand: 'Disney',
      category: 'Electronics > Video > Televisions',
      imageUrl: 'https://example.test/pirates-cover.jpg',
      mediaType: 'dvd',
      editionHint: null,
      regionHint: null,
      // "2-Disc" détecté dans le titre réel ("DVD + 2-Disc Blu-ray") — un
      // vrai signal de packaging pour ce combo pack, pas une erreur.
      packagingHint: '2-Disc',
    });
  });

  it('maps a real standalone Blu-ray as matched, mediaType "bluray", with edition and packaging hints from the title', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ code: 'OK', total: 1, items: [AVATAR_ITEM] }));

    const outcome = await makeProvider().lookup('792266015255');

    expect(outcome.status).toBe('matched');
    if (outcome.status !== 'matched') throw new Error('unreachable');
    expect(outcome.result.mediaType).toBe('bluray');
    expect(outcome.result.editionHint).toBe("Extended Collector's Edition");
    expect(outcome.result.packagingHint).toBe('Three-Disc');
    // Champs structurés réellement vides côté UPCitemdb pour ce produit —
    // jamais une valeur inventée pour compenser.
    expect(outcome.result.brand).toBeNull();
    expect(outcome.result.category).toBeNull();
    expect(outcome.result.imageUrl).toBeNull();
  });

  it('derives packagingHint and editionHint from offers[].title when absent from the main title', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ code: 'OK', total: 1, items: [DARK_KNIGHT_ITEM] }));

    const outcome = await makeProvider().lookup('883929308002');

    expect(outcome.status).toBe('matched');
    if (outcome.status !== 'matched') throw new Error('unreachable');
    expect(outcome.result.mediaType).toBe('bluray');
    expect(outcome.result.brand).toBe('Warner Bros.');
    // "6 Discs" n'apparaît que dans un `offers[].title`, jamais dans `title`.
    expect(outcome.result.packagingHint).toBe('6 Discs');
    expect(outcome.result.editionHint).toBe("Ultimate Collector's Edition");
    // `category` conservée pour inspection mais jamais utilisée pour classifier
    // (voir le test de classification négative ci-dessous : cette valeur
    // décrit littéralement un lecteur, pas un film).
    expect(outcome.result.category).toBe(
      'Electronics > Video > Video Players & Recorders > DVD & Blu-ray Players',
    );
  });

  it('classifies a Blu-ray correctly even when category is the only reliable-looking field ("Media")', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ code: 'OK', total: 1, items: [NINE_ITEM] }));

    const outcome = await makeProvider().lookup('065935831686');

    expect(outcome.status).toBe('matched');
    if (outcome.status !== 'matched') throw new Error('unreachable');
    expect(outcome.result.mediaType).toBe('bluray');
    expect(outcome.result.brand).toBe('Alliance Films');
  });

  it('treats a real non-video product (barcode known, category food) as not_video, never matched', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ code: 'OK', total: 1, items: [CHEERIOS_ITEM] }));

    const outcome = await makeProvider().lookup('016000487727');

    expect(outcome.status).toBe('not_video');
    if (outcome.status !== 'not_video') throw new Error('unreachable');
    expect(outcome.result.mediaType).toBe('unknown');
    // Le résultat reste inspectable (logs/tests) même rejeté comme non-vidéo.
    expect(outcome.result.rawTitle).toBe('Cheerios Cereal');
  });

  it('returns no_match on a documented NOT_FOUND (HTTP 404) — a completed search, not an error', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ code: 'NOT_FOUND' }, false, 404));

    const outcome = await makeProvider().lookup('000000000001');

    expect(outcome.status).toBe('no_match');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('never retries a 404 (NOT_FOUND is not a transient failure)', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ code: 'NOT_FOUND' }, false, 404));

    await makeProvider().lookup('000000000001');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns no_match when zero items match the requested barcode exactly (no fuzzy fallback)', async () => {
    const mismatched = { ...PIRATES_ITEM, upc: '999999999999', ean: '0999999999999' };
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ code: 'OK', total: 1, items: [mismatched] }));

    const outcome = await makeProvider().lookup('786936815481');

    expect(outcome.status).toBe('no_match');
  });

  it('returns no_match when several items all claim the requested barcode — never an arbitrary pick', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ code: 'OK', total: 2, items: [PIRATES_ITEM, PIRATES_ITEM] }),
      );

    const outcome = await makeProvider().lookup('786936815481');

    expect(outcome.status).toBe('no_match');
  });

  it('accepts an item lacking both upc and ean fields — nothing to validate against', async () => {
    const { upc: _upc, ean: _ean, ...withoutBarcodeFields } = PIRATES_ITEM;
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ code: 'OK', total: 1, items: [withoutBarcodeFields] }));

    const outcome = await makeProvider().lookup('786936815481');

    expect(outcome.status).toBe('matched');
  });

  it('throws a BarcodeProviderError on 429 TOO_FAST — never retried (daily quota is too precious)', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ code: 'TOO_FAST' }, false, 429));

    await expect(makeProvider().lookup('786936815481')).rejects.toBeInstanceOf(
      BarcodeProviderError,
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws a BarcodeProviderError on 429 EXCEED_LIMIT — never retried', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ code: 'EXCEED_LIMIT' }, false, 429));

    await expect(makeProvider().lookup('786936815481')).rejects.toBeInstanceOf(
      BarcodeProviderError,
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries once on a 5xx (SERVER_ERR), then succeeds', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 'SERVER_ERR' }, false, 503))
      .mockResolvedValueOnce(jsonResponse({ code: 'OK', total: 0, items: [] }));

    const outcome = await makeProvider().lookup('786936815481');

    expect(outcome.status).toBe('no_match');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws a BarcodeProviderError after exhausting both attempts on a persistent 5xx', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, false, 502));

    await expect(makeProvider().lookup('786936815481')).rejects.toBeInstanceOf(
      BarcodeProviderError,
    );
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('retries once on a network failure/timeout, then succeeds', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonResponse({ code: 'OK', total: 0, items: [] }));

    const outcome = await makeProvider().lookup('786936815481');

    expect(outcome.status).toBe('no_match');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws a BarcodeProviderError after exhausting both attempts on a persistent timeout', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    global.fetch = jest.fn().mockRejectedValue(abortError);

    await expect(makeProvider().lookup('786936815481')).rejects.toBeInstanceOf(
      BarcodeProviderError,
    );
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws a BarcodeProviderError on an unparseable 200 body (unexpected HTML from a gateway) — never a crash, never no_match', async () => {
    global.fetch = jest.fn().mockResolvedValue(unparseableResponse(true, 200));

    await expect(makeProvider().lookup('786936815481')).rejects.toBeInstanceOf(
      BarcodeProviderError,
    );
  });

  it('throws a BarcodeProviderError on an unparseable 5xx body, after exhausting retries', async () => {
    global.fetch = jest.fn().mockResolvedValue(unparseableResponse(false, 502));

    await expect(makeProvider().lookup('786936815481')).rejects.toBeInstanceOf(
      BarcodeProviderError,
    );
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('schedules every attempt (including retries) through the rate limiter', async () => {
    const schedule = jest.fn((task: () => unknown) => task());
    const rateLimiter = { schedule } as unknown as UpcItemDbRateLimiterService;
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, false, 503))
      .mockResolvedValueOnce(jsonResponse({ code: 'OK', total: 0, items: [] }));

    await new UpcItemDbProvider(fakeConfigService(), rateLimiter).lookup('786936815481');

    expect(schedule).toHaveBeenCalledTimes(2);
  });
});

describe('detectMediaType', () => {
  it('detects "dvd" from a real DVD+Blu-ray combo title (contains both keywords)', () => {
    expect(detectMediaType(PIRATES_ITEM.title)).toBe('dvd');
  });

  it('detects "bluray" from a real Blu-ray-only title', () => {
    expect(detectMediaType(AVATAR_ITEM.title)).toBe('bluray');
    expect(detectMediaType(NINE_ITEM.title)).toBe('bluray');
  });

  it('would misclassify if ever run on category — exactly why normalizeItem never does', () => {
    // Illustre concrètement le risque : la `category` réelle de ce produit
    // ("Electronics > Video > Video Players & Recorders > DVD & Blu-ray
    // Players") décrit un LECTEUR physique, pas un film — pourtant elle
    // contient le mot "DVD", donc `detectMediaType` la classerait 'dvd' si on
    // la lui passait. `normalizeItem` ne lui transmet jamais `category` (voir
    // `upcitemdb.provider.ts`), précisément pour éviter ce faux positif.
    expect(detectMediaType(DARK_KNIGHT_ITEM.category)).toBe('dvd');
  });

  it('returns "unknown" for a real non-video product (no DVD/Blu-ray keyword)', () => {
    expect(detectMediaType(CHEERIOS_ITEM.title + ' ' + CHEERIOS_ITEM.description)).toBe('unknown');
  });
});

describe('detectEditionHint', () => {
  it('captures the longest/most specific real edition phrase, never truncated', () => {
    expect(detectEditionHint(AVATAR_ITEM.title)).toBe("Extended Collector's Edition");
  });

  it('returns null when no known edition phrase is present', () => {
    expect(detectEditionHint(PIRATES_ITEM.title)).toBeNull();
  });
});

describe('detectPackagingHint', () => {
  it('detects a word-form disc count from a real title ("Three-Disc")', () => {
    expect(detectPackagingHint(AVATAR_ITEM.title)).toBe('Three-Disc');
  });

  it('detects a digit-form disc count from a real offer title ("6 Discs")', () => {
    const offerTitle = DARK_KNIGHT_ITEM.offers[1]?.title ?? '';
    expect(detectPackagingHint(offerTitle)).toBe('6 Discs');
  });

  it('returns null when no disc-count/box-set signal is present', () => {
    expect(detectPackagingHint(NINE_ITEM.title)).toBeNull();
  });
});

describe('detectRegionHint', () => {
  it('returns null for every real DVD/Blu-ray sample gathered — none exposed a region signal', () => {
    // Honnête sur les limites du POC : aucun des produits réels testés ne
    // contenait de mention de région — voir docs/DECISIONS.md.
    expect(detectRegionHint(PIRATES_ITEM.title)).toBeNull();
    expect(detectRegionHint(AVATAR_ITEM.title)).toBeNull();
    expect(detectRegionHint(DARK_KNIGHT_ITEM.title)).toBeNull();
    expect(detectRegionHint(NINE_ITEM.title + ' ' + NINE_ITEM.description)).toBeNull();
  });

  it('detects an explicit region mention when present', () => {
    expect(detectRegionHint('Some Movie [Region 1] [DVD]')).toBe('Region 1');
    expect(detectRegionHint('Some Movie (Region Free) [Blu-ray]')).toBe('Region Free');
  });
});

describe('selectMatchingItem', () => {
  it('selects the single item whose upc/ean matches the requested barcode', () => {
    const selection = selectMatchingItem([PIRATES_ITEM], '786936815481');
    expect(selection).toEqual({ kind: 'found', item: PIRATES_ITEM });
  });

  it('matches when the requested barcode is the 13-digit EAN and the item exposes only a 12-digit upc', () => {
    const selection = selectMatchingItem([PIRATES_ITEM], '0786936815481');
    expect(selection.kind).toBe('found');
  });

  it('returns "none" when no item matches the requested barcode', () => {
    const selection = selectMatchingItem([PIRATES_ITEM], '111111111111');
    expect(selection).toEqual({ kind: 'none' });
  });

  it('returns "ambiguous" when several items all match the requested barcode', () => {
    const selection = selectMatchingItem([PIRATES_ITEM, PIRATES_ITEM], '786936815481');
    expect(selection).toEqual({ kind: 'ambiguous' });
  });

  it('accepts an item exposing neither upc nor ean — nothing to validate', () => {
    const { upc: _upc, ean: _ean, ...withoutBarcodeFields } = PIRATES_ITEM;
    const selection = selectMatchingItem([withoutBarcodeFields], '786936815481');
    expect(selection.kind).toBe('found');
  });
});
