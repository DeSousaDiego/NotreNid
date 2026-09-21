import type { ConfigService } from '@nestjs/config';

import { BarcodeCacheService } from './barcode-cache.service';
import { CdBarcodeResolverService } from './cd-barcode-resolver.service';
import { CoverArtArchiveProvider } from './providers/cover-art-archive.provider';
import { MusicBrainzArtistCacheService } from './providers/musicbrainz-artist-cache.service';
import type { MusicBrainzRateLimiterService } from './providers/musicbrainz-rate-limiter.service';
import { MusicBrainzProvider } from './providers/musicbrainz.provider';
import type { CdProviderLookupResult } from './types/barcode-result.types';

const MATCH_RESULT: CdProviderLookupResult = {
  title: 'Discovery',
  cd: {
    artist: 'Daft Punk',
    releaseYear: 2001,
    label: 'Daft Life',
    format: 'CD',
    artistCountry: null,
  },
  coverUrl: 'https://example.test/cover.jpg',
};

function fakeMusicBrainz(lookup: MusicBrainzProvider['lookup']): MusicBrainzProvider {
  return { id: 'musicbrainz', lookup } as unknown as MusicBrainzProvider;
}

describe('CdBarcodeResolverService', () => {
  it('returns a matched response mapped under data.cd, never data.book', async () => {
    const lookup = jest.fn().mockResolvedValue(MATCH_RESULT);
    const service = new CdBarcodeResolverService(
      fakeMusicBrainz(lookup),
      new BarcodeCacheService(),
    );

    const response = await service.resolve('5099969236424');

    expect(response).toEqual({
      barcode: '5099969236424',
      category: 'cd',
      status: 'matched',
      match: true,
      source: 'musicbrainz',
      data: { title: 'Discovery', description: null, book: null, cd: MATCH_RESULT.cd },
      cover: { url: 'https://example.test/cover.jpg' },
    });
    expect(lookup).toHaveBeenCalledWith('5099969236424');
  });

  it('returns no_match when MusicBrainz responds but finds nothing exploitable', async () => {
    const lookup = jest.fn().mockResolvedValue(null);
    const service = new CdBarcodeResolverService(
      fakeMusicBrainz(lookup),
      new BarcodeCacheService(),
    );

    const response = await service.resolve('5099969236424');

    expect(response).toMatchObject({
      status: 'no_match',
      match: false,
      source: null,
      data: null,
      cover: null,
    });
  });

  it('returns provider_error when MusicBrainz throws — never no_match for a technical failure', async () => {
    const lookup = jest.fn().mockRejectedValue(new Error('timeout'));
    const service = new CdBarcodeResolverService(
      fakeMusicBrainz(lookup),
      new BarcodeCacheService(),
    );

    const response = await service.resolve('5099969236424');

    expect(response).toMatchObject({
      status: 'provider_error',
      match: false,
      source: null,
      data: null,
    });
  });

  it('serves a matched result from cache on a second call, without hitting MusicBrainz again', async () => {
    const lookup = jest.fn().mockResolvedValue(MATCH_RESULT);
    const service = new CdBarcodeResolverService(
      fakeMusicBrainz(lookup),
      new BarcodeCacheService(),
    );

    await service.resolve('5099969236424');
    await service.resolve('5099969236424');

    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('caches a no_match outcome too, without hitting MusicBrainz again', async () => {
    const lookup = jest.fn().mockResolvedValue(null);
    const service = new CdBarcodeResolverService(
      fakeMusicBrainz(lookup),
      new BarcodeCacheService(),
    );

    await service.resolve('5099969236424');
    await service.resolve('5099969236424');

    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('does not cache a provider_error outcome — the next scan must retry MusicBrainz', async () => {
    const lookup = jest.fn().mockRejectedValue(new Error('down'));
    const service = new CdBarcodeResolverService(
      fakeMusicBrainz(lookup),
      new BarcodeCacheService(),
    );

    await service.resolve('5099969236424');
    await service.resolve('5099969236424');

    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('caches under the "cd" category, isolated from "book" entries for the same barcode', async () => {
    const cache = new BarcodeCacheService();
    cache.set(
      'book',
      '5099969236424',
      {
        barcode: '5099969236424',
        category: 'book',
        status: 'matched',
        match: true,
        source: 'google-books',
        data: { title: 'Not a CD', description: null, book: null, cd: null },
        cover: null,
      },
      60_000,
    );
    const lookup = jest.fn().mockResolvedValue(MATCH_RESULT);
    const service = new CdBarcodeResolverService(fakeMusicBrainz(lookup), cache);

    const response = await service.resolve('5099969236424');

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(response.category).toBe('cd');
  });

  it('resolves end-to-end with the real MusicBrainzProvider chain (mocked fetch)', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn((url: string, _init?: RequestInit) => {
      if (url.includes('musicbrainz.org')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              count: 1,
              releases: [
                {
                  id: 'release-mbid-1',
                  title: 'Discovery',
                  status: 'Official',
                  date: '2001-03-12',
                  barcode: '5099969236424',
                  packaging: 'Jewel Case',
                  'label-info': [{ label: { name: 'Daft Life' } }],
                  media: [{ format: 'CD' }],
                  'artist-credit': [{ name: 'Daft Punk' }],
                },
              ],
            }),
        } as unknown as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
      } as unknown as Response);
    }) as unknown as typeof fetch;

    try {
      const configService = { get: () => undefined } as unknown as ConfigService;
      const service = new CdBarcodeResolverService(
        new MusicBrainzProvider(
          configService,
          { schedule: (task: () => unknown) => task() } as unknown as MusicBrainzRateLimiterService,
          new CoverArtArchiveProvider(configService),
          new MusicBrainzArtistCacheService(),
        ),
        new BarcodeCacheService(),
      );

      const response = await service.resolve('5099969236424');

      expect(response).toMatchObject({
        status: 'matched',
        source: 'musicbrainz',
        data: {
          title: 'Discovery',
          cd: { artist: 'Daft Punk', releaseYear: 2001, label: 'Daft Life', format: 'Jewel Case' },
        },
      });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
