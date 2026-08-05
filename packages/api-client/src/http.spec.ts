import { ApiError, NetworkError } from './errors';
import { createHttpClient } from './http';
import type { StoredTokens, TokenStorage } from './types';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function createMemoryTokenStorage(initial: StoredTokens | null = null): TokenStorage {
  let tokens = initial;
  return {
    getTokens: () => Promise.resolve(tokens),
    setTokens: (next) => {
      tokens = next;
      return Promise.resolve();
    },
    clearTokens: () => {
      tokens = null;
      return Promise.resolve();
    },
  };
}

describe('createHttpClient', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('attaches the Bearer token when tokens are present', async () => {
    const tokenStorage = createMemoryTokenStorage({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    const http = createHttpClient({ baseUrl: 'http://api.test', tokenStorage });
    await http.request('/me');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer access-1');
  });

  it('maps a non-ok response to an ApiError with the standard shape', async () => {
    const tokenStorage = createMemoryTokenStorage();
    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        statusCode: 409,
        code: 'EMAIL_ALREADY_USED',
        message: 'Cet email est déjà utilisé.',
        details: [],
        requestId: 'req-1',
      }),
    );

    const http = createHttpClient({ baseUrl: 'http://api.test', tokenStorage });
    await expect(http.request('/auth/register', { auth: false })).rejects.toMatchObject({
      code: 'EMAIL_ALREADY_USED',
      statusCode: 409,
    });
    expect(await http.request('/auth/register', { auth: false }).catch((e) => e)).toBeInstanceOf(
      ApiError,
    );
  });

  it('wraps a fetch failure in a NetworkError', async () => {
    const tokenStorage = createMemoryTokenStorage({ accessToken: 'a', refreshToken: 'r' });
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const http = createHttpClient({ baseUrl: 'http://api.test', tokenStorage });
    await expect(http.request('/me')).rejects.toBeInstanceOf(NetworkError);
  });

  it('refreshes once on 401 and retries the original request', async () => {
    const tokenStorage = createMemoryTokenStorage({
      accessToken: 'expired',
      refreshToken: 'refresh-1',
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { statusCode: 401, code: 'UNAUTHORIZED', message: '' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: 'new-access', refreshToken: 'new-refresh', user: {} }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { data: [] }));

    const http = createHttpClient({ baseUrl: 'http://api.test', tokenStorage });
    const result = await http.request('/households');

    expect(result).toEqual({ data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await expect(tokenStorage.getTokens()).resolves.toEqual({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
    // La requête d'origine est rejouée avec le nouveau token.
    const [, retryInit] = fetchMock.mock.calls[2];
    expect(retryInit.headers.Authorization).toBe('Bearer new-access');
  });

  it('clears tokens and reports session expiry when the refresh itself fails', async () => {
    const tokenStorage = createMemoryTokenStorage({
      accessToken: 'expired',
      refreshToken: 'also-expired',
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { statusCode: 401, code: 'UNAUTHORIZED', message: '' }))
      .mockResolvedValueOnce(
        jsonResponse(401, { statusCode: 401, code: 'INVALID_REFRESH_TOKEN', message: '' }),
      );

    const onSessionExpired = jest.fn();
    const http = createHttpClient({ baseUrl: 'http://api.test', tokenStorage, onSessionExpired });

    await expect(http.request('/households')).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    await expect(tokenStorage.getTokens()).resolves.toBeNull();
  });

  it('shares a single refresh across concurrent 401s (single-flight)', async () => {
    const tokenStorage = createMemoryTokenStorage({
      accessToken: 'expired',
      refreshToken: 'refresh-1',
    });
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(
          jsonResponse(200, { accessToken: 'new-access', refreshToken: 'new-refresh', user: {} }),
        );
      }
      const headers = (fetchMock.mock.calls.at(-1)?.[1]?.headers ?? {}) as Record<string, string>;
      if (headers.Authorization === 'Bearer new-access') {
        return Promise.resolve(jsonResponse(200, { ok: true }));
      }
      return Promise.resolve(jsonResponse(401, { statusCode: 401, code: 'UNAUTHORIZED', message: '' }));
    });

    const http = createHttpClient({ baseUrl: 'http://api.test', tokenStorage });
    await Promise.all([http.request('/a'), http.request('/b')]);

    const refreshCalls = fetchMock.mock.calls.filter(([url]) => (url as string).endsWith('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });
});
