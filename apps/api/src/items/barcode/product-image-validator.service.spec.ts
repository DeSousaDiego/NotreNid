import type { ConfigService } from '@nestjs/config';

import { ProductImageValidator } from './product-image-validator.service';

const config = { get: () => undefined } as unknown as ConfigService;

function response(
  status: number,
  options: { contentType?: string | null; url?: string } = {},
): Response {
  const headers = new Headers();
  if (options.contentType !== null) {
    headers.set('content-type', options.contentType ?? 'image/jpeg');
  }
  const res = new Response(status === 204 ? null : '', { status, headers });
  if (options.url) Object.defineProperty(res, 'url', { value: options.url });
  return res;
}

describe('ProductImageValidator', () => {
  const originalFetch = global.fetch;
  const HTTPS_URL = 'https://cdn-r.fishpond.com/0036/736/815/1204596519/6.jpeg';

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetch(...results: Array<Response | Error>): jest.Mock {
    const fn = jest.fn();
    for (const r of results) {
      if (r instanceof Error) fn.mockRejectedValueOnce(r);
      else fn.mockResolvedValueOnce(r);
    }
    global.fetch = fn as unknown as typeof fetch;
    return fn;
  }

  it('accepts an HTTPS image answering 2xx with an image content type', async () => {
    const fetchMock = mockFetch(response(200, { url: HTTPS_URL }));
    await expect(new ProductImageValidator(config).isUsable(HTTPS_URL)).resolves.toBe(true);
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('HEAD');
  });

  it('rejects an HTTPS URL answering 404 (real case: "9" eBay image)', async () => {
    mockFetch(response(404, { contentType: 'text/html' }));
    await expect(new ProductImageValidator(config).isUsable(HTTPS_URL)).resolves.toBe(false);
  });

  it('rejects an unreachable domain (real case: Pirates Azure CDN) — never throws', async () => {
    mockFetch(new TypeError('fetch failed'));
    await expect(new ProductImageValidator(config).isUsable(HTTPS_URL)).resolves.toBe(false);
  });

  it('rejects on timeout', async () => {
    mockFetch(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await expect(new ProductImageValidator(config).isUsable(HTTPS_URL)).resolves.toBe(false);
  });

  it('never exposes a cleartext http:// URL, without even calling it (real case: Cheerios)', async () => {
    const fetchMock = mockFetch();
    await expect(
      new ProductImageValidator(config).isUsable(
        'http://www.partridges.co.uk/cdn/shop/files/GeneralMillsCheerios340g.jpg',
      ),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never probes an IP literal or localhost supplied by a provider', async () => {
    const fetchMock = mockFetch();
    const validator = new ProductImageValidator(config);
    for (const url of [
      'https://169.254.169.254/latest/meta-data',
      'https://10.0.0.5/cover.jpg',
      'https://[::1]/cover.jpg',
      'https://localhost/cover.jpg',
    ]) {
      await expect(validator.isUsable(url)).resolves.toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an absent or malformed URL', async () => {
    const validator = new ProductImageValidator(config);
    await expect(validator.isUsable(null)).resolves.toBe(false);
    await expect(validator.isUsable('not a url')).resolves.toBe(false);
  });

  it('rejects a redirect ending on a cleartext URL', async () => {
    mockFetch(response(200, { url: 'http://insecure.example/image.jpg' }));
    await expect(new ProductImageValidator(config).isUsable(HTTPS_URL)).resolves.toBe(false);
  });

  it('rejects a non-image content (e.g. an HTML error page served with 200)', async () => {
    mockFetch(response(200, { contentType: 'text/html; charset=utf-8' }));
    await expect(new ProductImageValidator(config).isUsable(HTTPS_URL)).resolves.toBe(false);
  });

  it('falls back to a one-byte GET when the CDN refuses HEAD', async () => {
    const fetchMock = mockFetch(response(405, { contentType: null }), response(206));
    await expect(new ProductImageValidator(config).isUsable(HTTPS_URL)).resolves.toBe(true);
    const second = fetchMock.mock.calls[1][1] as RequestInit;
    expect(second.method).toBe('GET');
    expect(second.headers).toEqual({ Range: 'bytes=0-0' });
  });
});
