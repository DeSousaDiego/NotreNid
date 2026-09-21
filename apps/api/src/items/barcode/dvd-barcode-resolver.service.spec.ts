import { BarcodeCacheService } from './barcode-cache.service';
import { DvdBarcodeResolverService } from './dvd-barcode-resolver.service';
import type { DvdEnrichmentOutcome } from './dvd-enrichment.service';
import type { UpcItemDbLookupOutcome, UpcItemDbProvider } from './providers/upcitemdb.provider';
import type { TmdbMovieResult, UpcItemDbPocResult } from './types/dvd-poc.types';

const UPC_RESULT: UpcItemDbPocResult = {
  barcode: '786936815481',
  rawTitle: "Pirates of the Caribbean: At World's End (DVD + 2-Disc Blu-ray)",
  description: 'Bloopers of the Caribbean',
  brand: 'Disney',
  category: 'Electronics > Video > Televisions',
  imageUrl: 'https://example.test/pirates-cover.jpg',
  mediaType: 'dvd',
  editionHint: null,
  regionHint: null,
  packagingHint: '2-Disc',
};

const TMDB_MOVIE: TmdbMovieResult = {
  id: 285,
  title: "Pirates of the Caribbean: At World's End",
  overview: 'After losing Captain Jack Sparrow to the locker of Davy Jones...',
  releaseYear: 2007,
  runtime: 169,
  director: 'Gore Verbinski',
  countryCodes: ['US'],
  posterUrl: 'https://image.tmdb.org/t/p/w500/jGWpG4YhpQwVmjyHEGkxEkeRf0S.jpg',
};

function fakeUpcItemDb(
  lookup: (barcode: string) => Promise<UpcItemDbLookupOutcome>,
): UpcItemDbProvider {
  return { id: 'upcitemdb', lookup } as unknown as UpcItemDbProvider;
}

function fakeEnrichment(enrich: () => Promise<DvdEnrichmentOutcome>): {
  enrich: () => Promise<DvdEnrichmentOutcome>;
} {
  return { enrich };
}

describe('DvdBarcodeResolverService', () => {
  it('returns a full matched response on the public contract — UPC + TMDB merged', async () => {
    const upcLookup = jest.fn().mockResolvedValue({ status: 'matched', result: UPC_RESULT });
    const enrich = jest.fn().mockResolvedValue({ kind: 'resolved', movie: TMDB_MOVIE });
    const service = new DvdBarcodeResolverService(
      fakeUpcItemDb(upcLookup),
      fakeEnrichment(enrich) as never,
      new BarcodeCacheService(),
    );

    const response = await service.resolve('786936815481');

    expect(response).toEqual({
      barcode: '786936815481',
      category: 'dvd',
      status: 'matched',
      match: true,
      source: 'upcitemdb',
      data: {
        title: "Pirates of the Caribbean: At World's End",
        description: 'After losing Captain Jack Sparrow to the locker of Davy Jones...',
        book: null,
        cd: null,
        dvd: {
          director: 'Gore Verbinski',
          releaseYear: 2007,
          duration: 169,
          edition: null,
          region: null,
          format: '2-Disc',
        },
        countryCodes: ['US'],
      },
      cover: { url: 'https://example.test/pirates-cover.jpg' },
    });
  });

  it('prefers the UPC cover image over the TMDB poster', async () => {
    const upcLookup = jest.fn().mockResolvedValue({ status: 'matched', result: UPC_RESULT });
    const enrich = jest.fn().mockResolvedValue({ kind: 'resolved', movie: TMDB_MOVIE });
    const service = new DvdBarcodeResolverService(
      fakeUpcItemDb(upcLookup),
      fakeEnrichment(enrich) as never,
      new BarcodeCacheService(),
    );

    const response = await service.resolve('786936815481');

    expect(response.cover?.url).toBe(UPC_RESULT.imageUrl);
    expect(response.cover?.url).not.toBe(TMDB_MOVIE.posterUrl);
  });

  it('falls back to the TMDB poster when UPCitemdb has no image', async () => {
    const upcLookup = jest
      .fn()
      .mockResolvedValue({ status: 'matched', result: { ...UPC_RESULT, imageUrl: null } });
    const enrich = jest.fn().mockResolvedValue({ kind: 'resolved', movie: TMDB_MOVIE });
    const service = new DvdBarcodeResolverService(
      fakeUpcItemDb(upcLookup),
      fakeEnrichment(enrich) as never,
      new BarcodeCacheService(),
    );

    const response = await service.resolve('786936815481');

    expect(response.cover?.url).toBe(TMDB_MOVIE.posterUrl);
  });

  it('returns "partial" (never provider_error, never no_match) when TMDB finds no confident candidate — only UPC-reliable fields populated', async () => {
    const upcLookup = jest.fn().mockResolvedValue({ status: 'matched', result: UPC_RESULT });
    const enrich = jest.fn().mockResolvedValue({ kind: 'unresolved' });
    const service = new DvdBarcodeResolverService(
      fakeUpcItemDb(upcLookup),
      fakeEnrichment(enrich) as never,
      new BarcodeCacheService(),
    );

    const response = await service.resolve('786936815481');

    expect(response.status).toBe('partial');
    expect(response.match).toBe(false);
    expect(response.source).toBe('upcitemdb');
    expect(response.data).toEqual({
      title: "Pirates of the Caribbean: At World's End",
      description: 'Bloopers of the Caribbean',
      book: null,
      cd: null,
      dvd: {
        director: null,
        releaseYear: null,
        duration: null,
        edition: null,
        region: null,
        format: '2-Disc',
      },
      countryCodes: null,
    });
    expect(response.cover).toEqual({ url: 'https://example.test/pirates-cover.jpg' });
  });

  it('returns "partial" — a real boxset scenario (Dark Knight Trilogy) never forced into a fabricated film match', async () => {
    const boxsetResult: UpcItemDbPocResult = {
      ...UPC_RESULT,
      barcode: '883929308002',
      rawTitle: 'The Dark Knight Trilogy [Blu-ray]',
      brand: 'Warner Bros.',
      mediaType: 'bluray',
      packagingHint: null,
    };
    const upcLookup = jest.fn().mockResolvedValue({ status: 'matched', result: boxsetResult });
    // Représente ce que `DvdEnrichmentService` renvoie réellement pour ce cas
    // (documentaire réel rejeté par le scoring, voir tmdb.provider.spec.ts).
    const enrich = jest.fn().mockResolvedValue({ kind: 'unresolved' });
    const service = new DvdBarcodeResolverService(
      fakeUpcItemDb(upcLookup),
      fakeEnrichment(enrich) as never,
      new BarcodeCacheService(),
    );

    const response = await service.resolve('883929308002');

    expect(response.status).toBe('partial');
    expect(response.data?.dvd?.director).toBeNull();
    expect(response.data?.title).toBe('The Dark Knight Trilogy');
  });

  it('returns "partial" (never provider_error) when TMDB fails technically — UPC data still exploitable', async () => {
    const upcLookup = jest.fn().mockResolvedValue({ status: 'matched', result: UPC_RESULT });
    const enrich = jest
      .fn()
      .mockResolvedValue({ kind: 'provider_error', error: new Error('timeout') });
    const service = new DvdBarcodeResolverService(
      fakeUpcItemDb(upcLookup),
      fakeEnrichment(enrich) as never,
      new BarcodeCacheService(),
    );

    const response = await service.resolve('786936815481');

    expect(response.status).toBe('partial');
    expect(response.data?.title).toBe("Pirates of the Caribbean: At World's End");
    expect(response.source).toBe('upcitemdb');
  });

  it('returns no_match when UPCitemdb itself has no result', async () => {
    const upcLookup = jest.fn().mockResolvedValue({ status: 'no_match' });
    const enrich = jest.fn();
    const service = new DvdBarcodeResolverService(
      fakeUpcItemDb(upcLookup),
      fakeEnrichment(enrich) as never,
      new BarcodeCacheService(),
    );

    const response = await service.resolve('786936815481');

    expect(response).toEqual({
      barcode: '786936815481',
      category: 'dvd',
      status: 'no_match',
      match: false,
      source: null,
      data: null,
      cover: null,
    });
    // TMDB n'est jamais interrogé si UPCitemdb lui-même n'a rien trouvé.
    expect(enrich).not.toHaveBeenCalled();
  });

  it('flattens a "not_video" UPC outcome into no_match, never calling TMDB', async () => {
    const nonVideoResult: UpcItemDbPocResult = { ...UPC_RESULT, mediaType: 'unknown' };
    const upcLookup = jest.fn().mockResolvedValue({ status: 'not_video', result: nonVideoResult });
    const enrich = jest.fn();
    const service = new DvdBarcodeResolverService(
      fakeUpcItemDb(upcLookup),
      fakeEnrichment(enrich) as never,
      new BarcodeCacheService(),
    );

    const response = await service.resolve('016000487727');

    expect(response.status).toBe('no_match');
    expect(enrich).not.toHaveBeenCalled();
  });

  it('returns provider_error when UPCitemdb itself throws — never no_match/partial for a technical failure', async () => {
    const upcLookup = jest.fn().mockRejectedValue(new Error('timeout'));
    const enrich = jest.fn();
    const service = new DvdBarcodeResolverService(
      fakeUpcItemDb(upcLookup),
      fakeEnrichment(enrich) as never,
      new BarcodeCacheService(),
    );

    const response = await service.resolve('786936815481');

    expect(response).toEqual({
      barcode: '786936815481',
      category: 'dvd',
      status: 'provider_error',
      match: false,
      source: null,
      data: null,
      cover: null,
    });
    expect(enrich).not.toHaveBeenCalled();
  });

  it('caches a full matched result under the "dvd" category — a second call hits neither UPCitemdb nor TMDB', async () => {
    const upcLookup = jest.fn().mockResolvedValue({ status: 'matched', result: UPC_RESULT });
    const enrich = jest.fn().mockResolvedValue({ kind: 'resolved', movie: TMDB_MOVIE });
    const service = new DvdBarcodeResolverService(
      fakeUpcItemDb(upcLookup),
      fakeEnrichment(enrich) as never,
      new BarcodeCacheService(),
    );

    await service.resolve('786936815481');
    await service.resolve('786936815481');

    expect(upcLookup).toHaveBeenCalledTimes(1);
    expect(enrich).toHaveBeenCalledTimes(1);
  });

  it('caches a "partial" (TMDB unresolved) result too — a real completed search, not transient', async () => {
    const upcLookup = jest.fn().mockResolvedValue({ status: 'matched', result: UPC_RESULT });
    const enrich = jest.fn().mockResolvedValue({ kind: 'unresolved' });
    const service = new DvdBarcodeResolverService(
      fakeUpcItemDb(upcLookup),
      fakeEnrichment(enrich) as never,
      new BarcodeCacheService(),
    );

    await service.resolve('786936815481');
    await service.resolve('786936815481');

    expect(upcLookup).toHaveBeenCalledTimes(1);
    expect(enrich).toHaveBeenCalledTimes(1);
  });

  it('never caches a "partial" result caused by a TMDB technical failure — a later scan may succeed', async () => {
    const upcLookup = jest.fn().mockResolvedValue({ status: 'matched', result: UPC_RESULT });
    const enrich = jest
      .fn()
      .mockResolvedValue({ kind: 'provider_error', error: new Error('down') });
    const service = new DvdBarcodeResolverService(
      fakeUpcItemDb(upcLookup),
      fakeEnrichment(enrich) as never,
      new BarcodeCacheService(),
    );

    await service.resolve('786936815481');
    await service.resolve('786936815481');

    expect(upcLookup).toHaveBeenCalledTimes(2);
    expect(enrich).toHaveBeenCalledTimes(2);
  });

  it('does not cache a provider_error outcome (UPCitemdb itself failing) — the next scan must retry', async () => {
    const upcLookup = jest.fn().mockRejectedValue(new Error('down'));
    const service = new DvdBarcodeResolverService(
      fakeUpcItemDb(upcLookup),
      fakeEnrichment(jest.fn()) as never,
      new BarcodeCacheService(),
    );

    await service.resolve('786936815481');
    await service.resolve('786936815481');

    expect(upcLookup).toHaveBeenCalledTimes(2);
  });

  it('caches a no_match outcome too, without hitting UPCitemdb again', async () => {
    const upcLookup = jest.fn().mockResolvedValue({ status: 'no_match' });
    const service = new DvdBarcodeResolverService(
      fakeUpcItemDb(upcLookup),
      fakeEnrichment(jest.fn()) as never,
      new BarcodeCacheService(),
    );

    await service.resolve('786936815481');
    await service.resolve('786936815481');

    expect(upcLookup).toHaveBeenCalledTimes(1);
  });

  it('caches under the "dvd" category, isolated from "cd"/"book" entries for the same barcode', async () => {
    const cache = new BarcodeCacheService();
    cache.set(
      'cd',
      '786936815481',
      {
        barcode: '786936815481',
        category: 'cd',
        status: 'no_match',
        match: false,
        source: null,
        data: null,
        cover: null,
      },
      60_000,
    );
    const upcLookup = jest.fn().mockResolvedValue({ status: 'matched', result: UPC_RESULT });
    const enrich = jest.fn().mockResolvedValue({ kind: 'resolved', movie: TMDB_MOVIE });
    const service = new DvdBarcodeResolverService(
      fakeUpcItemDb(upcLookup),
      fakeEnrichment(enrich) as never,
      cache,
    );

    const response = await service.resolve('786936815481');

    expect(upcLookup).toHaveBeenCalledTimes(1);
    expect(response.category).toBe('dvd');
    expect(response.status).toBe('matched');
  });
});
