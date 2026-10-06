import type { ConfigService } from '@nestjs/config';

import { CoverArtArchiveProvider, toSecureCoverUrl } from './cover-art-archive.provider';

function fakeConfigService(values: Record<string, unknown> = {}): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: () => Promise.resolve(body) } as unknown as Response;
}

const MBID = 'release-mbid-1';

describe('CoverArtArchiveProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('requests the release endpoint for the given MBID', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ images: [] }));

    await new CoverArtArchiveProvider(fakeConfigService()).fetchFrontCoverUrl(MBID);

    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string];
    expect(url).toBe(`https://coverartarchive.org/release/${MBID}`);
  });

  it('prefers the "500" thumbnail (current key) of the image explicitly flagged front', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        images: [
          { front: false, image: 'https://example.test/back.jpg' },
          {
            front: true,
            image: 'https://example.test/front-full.jpg',
            thumbnails: {
              '500': 'https://example.test/front-500.jpg',
              large: 'https://example.test/front-large.jpg',
            },
          },
        ],
      }),
    );

    const url = await new CoverArtArchiveProvider(fakeConfigService()).fetchFrontCoverUrl(MBID);

    expect(url).toBe('https://example.test/front-500.jpg');
  });

  it('falls back to the deprecated "large" thumbnail when "500" is absent', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        images: [
          {
            front: true,
            image: 'https://example.test/front-full.jpg',
            thumbnails: { large: 'https://example.test/front-large.jpg' },
          },
        ],
      }),
    );

    const url = await new CoverArtArchiveProvider(fakeConfigService()).fetchFrontCoverUrl(MBID);

    expect(url).toBe('https://example.test/front-large.jpg');
  });

  it('falls back to the full image when no thumbnail (neither "500" nor "large") is present', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ images: [{ front: true, image: 'https://example.test/front-full.jpg' }] }),
      );

    const url = await new CoverArtArchiveProvider(fakeConfigService()).fetchFrontCoverUrl(MBID);

    expect(url).toBe('https://example.test/front-full.jpg');
  });

  it('falls back to the first image when none is explicitly flagged front', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ images: [{ image: 'https://example.test/only.jpg' }] }));

    const url = await new CoverArtArchiveProvider(fakeConfigService()).fetchFrontCoverUrl(MBID);

    expect(url).toBe('https://example.test/only.jpg');
  });

  it('upgrades a legacy http:// Cover Art Archive URL to https:// (Android blocks cleartext images)', async () => {
    // Forme réelle observée le 2026-10-06 sur un index.json ancien : pas de
    // clé "500", URLs en http://.
    const legacyMbid = 'e69e2f55-a2c0-472e-b30b-f43b565b3fbe';
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        images: [
          {
            front: true,
            image: `http://coverartarchive.org/release/${legacyMbid}/6739151461.jpg`,
            thumbnails: {
              large: `http://coverartarchive.org/release/${legacyMbid}/6739151461-500.jpg`,
            },
          },
        ],
      }),
    );

    const url = await new CoverArtArchiveProvider(fakeConfigService()).fetchFrontCoverUrl(
      legacyMbid,
    );

    expect(url).toBe(`https://coverartarchive.org/release/${legacyMbid}/6739151461-500.jpg`);
  });

  it('never rewrites an http:// URL pointing to another host', () => {
    expect(toSecureCoverUrl('http://example.test/front.jpg')).toBe('http://example.test/front.jpg');
    expect(toSecureCoverUrl('https://coverartarchive.org/release/x/1.jpg')).toBe(
      'https://coverartarchive.org/release/x/1.jpg',
    );
  });

  it('returns null (not an error) when there is no cover art at all (404)', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, false, 404));

    expect(
      await new CoverArtArchiveProvider(fakeConfigService()).fetchFrontCoverUrl(MBID),
    ).toBeNull();
  });

  it('returns null (not an error) on any other non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, false, 503));

    expect(
      await new CoverArtArchiveProvider(fakeConfigService()).fetchFrontCoverUrl(MBID),
    ).toBeNull();
  });

  it('returns null (not an error) on a network failure or timeout — never throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    await expect(
      new CoverArtArchiveProvider(fakeConfigService()).fetchFrontCoverUrl(MBID),
    ).resolves.toBeNull();
  });

  it('returns null (not an error) when the response body is unreadable', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('bad json')),
    });

    await expect(
      new CoverArtArchiveProvider(fakeConfigService()).fetchFrontCoverUrl(MBID),
    ).resolves.toBeNull();
  });

  it('returns null (not an error) when there are no images at all', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ images: [] }));

    expect(
      await new CoverArtArchiveProvider(fakeConfigService()).fetchFrontCoverUrl(MBID),
    ).toBeNull();
  });
});
