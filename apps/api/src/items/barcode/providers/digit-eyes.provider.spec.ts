import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { BarcodeProviderError } from './barcode-provider.error';
import {
  DigitEyesProvider,
  classifyDigitEyesFailure,
  normalizeDigitEyesProduct,
  signDigitEyesRequest,
} from './digit-eyes.provider';
import {
  DIGITEYES_AVATAR,
  DIGITEYES_CHEERIOS,
  DIGITEYES_DARK_KNIGHT_TRILOGY,
  DIGITEYES_NINE_BLURAY,
  DIGITEYES_PIRATES,
} from '../test-fixtures/digiteyes';

// Valeurs de test factices — jamais de vraies clés dans le dépôt.
const APP_KEY = 'test-app-key-123';
const AUTH_KEY = 'test-auth-key-456';

function fakeConfig(values: Record<string, unknown> = {}): ConfigService {
  const all: Record<string, unknown> = {
    DIGITEYES_APP_KEY: APP_KEY,
    DIGITEYES_AUTH_KEY: AUTH_KEY,
    ...values,
  };
  return { get: (key: string) => all[key] } as unknown as ConfigService;
}

function jsonResponse(body: unknown, status = 200, charset = 'utf-8'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': `application/json; charset=${charset}` },
  });
}

describe('signDigitEyesRequest', () => {
  it('computes base64(HMAC-SHA1(auth_key, upc_code)) — RFC 2104 reference vector', () => {
    // Vecteur de référence HMAC-SHA1 standard (clé "key"), encodé en base64 :
    // de7c9b85b8b78aa6bc8a7a36f70a90701c9db4d9 → 3nybhbi3iqa8ino29wqQcBydtNk=
    expect(signDigitEyesRequest('The quick brown fox jumps over the lazy dog', 'key')).toBe(
      '3nybhbi3iqa8ino29wqQcBydtNk=',
    );
  });
});

describe('classifyDigitEyesFailure', () => {
  it.each([
    [200, '0', null],
    [200, null, null],
    [404, '999', { outcome: 'no_match' }],
    [400, '995', { outcome: 'no_match' }],
    [400, '998', { outcome: 'no_match' }],
    [200, '7', { outcome: 'no_match' }],
    [401, '992', { outcome: 'error', kind: 'auth' }],
    [401, '996', { outcome: 'error', kind: 'auth' }],
    [402, '666', { outcome: 'error', kind: 'quota' }],
    [402, null, { outcome: 'error', kind: 'quota' }],
    [400, '994', { outcome: 'error', kind: 'invalid_response' }],
    [503, null, { outcome: 'error', kind: 'unavailable' }],
    // Code inconnu sur un 200 : jamais un no_match mis en cache.
    [200, '42', { outcome: 'error', kind: 'unavailable' }],
  ])('HTTP %s / code %s (JSON body) → %j', (status, code, expected) => {
    expect(classifyDigitEyesFailure(status, code, true)).toEqual(expected);
  });

  it('treats a 404 without a JSON body (proxy page, moved endpoint) as unavailable, never no_match', () => {
    expect(classifyDigitEyesFailure(404, null, false)).toEqual({
      outcome: 'error',
      kind: 'unavailable',
    });
    expect(classifyDigitEyesFailure(404, null, true)).toEqual({ outcome: 'no_match' });
  });

  it('never classifies quota or auth as no_match, even with a "not found" return code', () => {
    expect(classifyDigitEyesFailure(402, '999', true)).toEqual({ outcome: 'error', kind: 'quota' });
    expect(classifyDigitEyesFailure(401, '999', true)).toEqual({ outcome: 'error', kind: 'auth' });
  });
});

describe('normalizeDigitEyesProduct (real POC fixtures)', () => {
  it('"9": Blu-ray from the title, region hint, raw image kept for later validation', () => {
    const outcome = normalizeDigitEyesProduct(
      DIGITEYES_NINE_BLURAY.response,
      DIGITEYES_NINE_BLURAY.barcode,
    );
    expect(outcome.status).toBe('matched');
    if (outcome.status !== 'matched') return;
    expect(outcome.result).toMatchObject({
      barcode: '065935831686',
      rawTitle: '9 [blu-ray] [2009] [region 1] []',
      mediaType: 'bluray',
      regionHint: 'region 1',
      description: null,
      imageUrl: DIGITEYES_NINE_BLURAY.response.image,
    });
  });

  it('Dark Knight Trilogy: video ONLY through categories — format left undetermined, never forced to DVD', () => {
    const outcome = normalizeDigitEyesProduct(
      DIGITEYES_DARK_KNIGHT_TRILOGY.response,
      DIGITEYES_DARK_KNIGHT_TRILOGY.barcode,
    );
    expect(outcome.status).toBe('matched');
    if (outcome.status !== 'matched') return;
    // Les catégories contiennent "DVD" ET "Blu-ray HD DVD" : un détecteur
    // naïf en ferait un DVD — le format doit rester indéterminé.
    expect(outcome.result.mediaType).toBe('video');
    expect(outcome.result.editionHint).toBe('Ultimate Collectors Edition');
    expect(outcome.result.brand).toBe('Warner Bros.');
  });

  it('Pirates: DVD combo from the title, disc count hint, generic category never decides the format', () => {
    const outcome = normalizeDigitEyesProduct(
      DIGITEYES_PIRATES.response,
      DIGITEYES_PIRATES.barcode,
    );
    expect(outcome.status).toBe('matched');
    if (outcome.status !== 'matched') return;
    expect(outcome.result.mediaType).toBe('dvd');
    expect(outcome.result.packagingHint).toBe('2-disc');
  });

  it('Avatar: Blu-ray from the title, no categories and no image', () => {
    const outcome = normalizeDigitEyesProduct(DIGITEYES_AVATAR.response, DIGITEYES_AVATAR.barcode);
    expect(outcome.status).toBe('matched');
    if (outcome.status !== 'matched') return;
    expect(outcome.result.mediaType).toBe('bluray');
    expect(outcome.result.imageUrl).toBeNull();
    expect(outcome.result.category).toBeNull();
  });

  it('Cheerios: known product without any video signal → not_video', () => {
    const outcome = normalizeDigitEyesProduct(
      DIGITEYES_CHEERIOS.response,
      DIGITEYES_CHEERIOS.barcode,
    );
    expect(outcome.status).toBe('not_video');
  });

  it('ignores seller free text (usage) for video detection and hints — no false positive', () => {
    const outcome = normalizeDigitEyesProduct(
      {
        ...DIGITEYES_CHEERIOS.response,
        usage: 'Bonus: includes a free workout DVD! Region Free, 2 Discs.',
      },
      DIGITEYES_CHEERIOS.barcode,
    );
    expect(outcome.status).toBe('not_video');
    if (outcome.status !== 'not_video') return;
    expect(outcome.result.regionHint).toBeNull();
    expect(outcome.result.packagingHint).toBeNull();
  });

  it('rejects a product whose returned code differs from the requested one', () => {
    expect(
      normalizeDigitEyesProduct(DIGITEYES_PIRATES.response, DIGITEYES_NINE_BLURAY.barcode),
    ).toEqual({ status: 'no_match' });
  });

  it('treats a response without a product title as no_match', () => {
    expect(
      normalizeDigitEyesProduct(
        { ...DIGITEYES_PIRATES.response, description: '  ' },
        DIGITEYES_PIRATES.barcode,
      ),
    ).toEqual({ status: 'no_match' });
  });
});

describe('DigitEyesProvider.lookup', () => {
  const originalFetch = global.fetch;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function mockFetch(...responses: Array<Response | Error>): jest.Mock {
    const fn = jest.fn();
    for (const response of responses) {
      if (response instanceof Error) fn.mockRejectedValueOnce(response);
      else fn.mockResolvedValueOnce(response);
    }
    global.fetch = fn as unknown as typeof fetch;
    return fn;
  }

  function loggedText(): string {
    return warnSpy.mock.calls.map((call) => call.map(String).join(' ')).join('\n');
  }

  it('requests v2 JSON with field_names=all,categories and a valid signature', async () => {
    const fetchMock = mockFetch(jsonResponse(DIGITEYES_PIRATES.response));

    await new DigitEyesProvider(fakeConfig()).lookup(DIGITEYES_PIRATES.barcode);

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe('https://www.digit-eyes.com/gtin/v2_0/');
    expect(url.searchParams.get('field_names')).toBe('all,categories');
    expect(url.searchParams.get('upc_code')).toBe(DIGITEYES_PIRATES.barcode);
    expect(url.searchParams.get('app_key')).toBe(APP_KEY);
    expect(url.searchParams.get('signature')).toBe(
      signDigitEyesRequest(DIGITEYES_PIRATES.barcode, AUTH_KEY),
    );
  });

  it('normalizes a found product (Pirates fixture)', async () => {
    mockFetch(jsonResponse(DIGITEYES_PIRATES.response));

    const outcome = await new DigitEyesProvider(fakeConfig()).lookup(DIGITEYES_PIRATES.barcode);

    expect(outcome.status).toBe('matched');
    if (outcome.status === 'matched') {
      expect(outcome.result.rawTitle).toBe(DIGITEYES_PIRATES.response.description);
    }
  });

  it('decodes an ISO-8859-1 body correctly (charset announced by Digit-Eyes)', async () => {
    const body = JSON.stringify({ ...DIGITEYES_PIRATES.response, description: 'Amélie DVD' });
    global.fetch = jest.fn().mockResolvedValue(
      new Response(Buffer.from(body, 'latin1'), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=ISO-8859-1' },
      }),
    ) as unknown as typeof fetch;

    const outcome = await new DigitEyesProvider(fakeConfig()).lookup(DIGITEYES_PIRATES.barcode);

    expect(outcome.status === 'matched' && outcome.result.rawTitle).toBe('Amélie DVD');
  });

  it('returns no_match on 404 / return code 999', async () => {
    mockFetch(jsonResponse({ return_code: '999', return_message: 'Not found' }, 404));
    await expect(new DigitEyesProvider(fakeConfig()).lookup('012345678905')).resolves.toEqual({
      status: 'no_match',
    });
  });

  it.each([
    [401, '992', 'auth'],
    [402, '666', 'quota'],
  ])(
    'throws a typed BarcodeProviderError on HTTP %s (code %s) — never no_match',
    async (status, code, kind) => {
      const fetchMock = mockFetch(jsonResponse({ return_code: code }, status));

      const error = await new DigitEyesProvider(fakeConfig())
        .lookup('012345678905')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BarcodeProviderError);
      expect((error as BarcodeProviderError).kind).toBe(kind);
      // Erreur déterministe : jamais retentée (chaque requête est facturée).
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('retries a 5xx once, then throws an "unavailable" error', async () => {
    const fetchMock = mockFetch(jsonResponse({}, 503), jsonResponse({}, 503));

    const error = await new DigitEyesProvider(fakeConfig())
      .lookup('012345678905')
      .catch((e: unknown) => e);

    expect((error as BarcodeProviderError).kind).toBe('unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws a "timeout" error when every attempt is aborted', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    mockFetch(abort, abort);

    const error = await new DigitEyesProvider(fakeConfig())
      .lookup('012345678905')
      .catch((e: unknown) => e);

    expect((error as BarcodeProviderError).kind).toBe('timeout');
  });

  it('times out within the budget when the server sends headers then stalls the body', async () => {
    global.fetch = jest.fn((_url: string, init?: RequestInit) => {
      const body = new ReadableStream({
        start(controller) {
          init?.signal?.addEventListener('abort', () =>
            controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        },
      });
      return Promise.resolve(
        new Response(body, { status: 200, headers: { 'content-type': 'application/json' } }),
      );
    }) as unknown as typeof fetch;
    const config = fakeConfig({ DIGITEYES_TIMEOUT_BUDGET_MS: 2000 });

    const startedAt = Date.now();
    const error = await new DigitEyesProvider(config).lookup('012345678905').catch((e) => e);

    expect((error as BarcodeProviderError).kind).toBe('timeout');
    expect(Date.now() - startedAt).toBeLessThan(4000);
  });

  it('trims credentials before signing (a pasted trailing space must not break the signature)', async () => {
    const fetchMock = mockFetch(jsonResponse(DIGITEYES_PIRATES.response));
    const config = fakeConfig({
      DIGITEYES_APP_KEY: ` ${APP_KEY} `,
      DIGITEYES_AUTH_KEY: `${AUTH_KEY}\n`,
    });

    await new DigitEyesProvider(config).lookup(DIGITEYES_PIRATES.barcode);

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('app_key')).toBe(APP_KEY);
    expect(url.searchParams.get('signature')).toBe(
      signDigitEyesRequest(DIGITEYES_PIRATES.barcode, AUTH_KEY),
    );
  });

  it('throws an "auth" error without any network call when credentials are missing', async () => {
    const fetchMock = mockFetch();
    const config = fakeConfig({ DIGITEYES_APP_KEY: undefined });

    const error = await new DigitEyesProvider(config)
      .lookup('012345678905')
      .catch((e: unknown) => e);

    expect((error as BarcodeProviderError).kind).toBe('auth');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never logs nor exposes the app key, the auth key or the signature', async () => {
    const networkError = new Error(
      `fetch failed for https://www.digit-eyes.com/gtin/v2_0/?app_key=${APP_KEY}`,
    );
    mockFetch(jsonResponse({ return_code: '666' }, 402));
    const quotaError = await new DigitEyesProvider(fakeConfig())
      .lookup('012345678905')
      .catch((e: unknown) => e);
    mockFetch(networkError, networkError);
    const netError = await new DigitEyesProvider(fakeConfig())
      .lookup('012345678905')
      .catch((e: unknown) => e);

    const signature = signDigitEyesRequest('012345678905', AUTH_KEY);
    const exposed = [
      loggedText(),
      (quotaError as Error).message,
      (netError as Error).message,
      String((netError as Error).cause ?? ''),
    ].join('\n');
    for (const secret of [APP_KEY, AUTH_KEY, signature, encodeURIComponent(signature)]) {
      expect(exposed).not.toContain(secret);
    }
    expect(warnSpy).toHaveBeenCalled();
  });
});
