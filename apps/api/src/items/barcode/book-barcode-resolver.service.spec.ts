import type { ConfigService } from '@nestjs/config';

import { BarcodeCacheService } from './barcode-cache.service';
import { BookBarcodeResolverService } from './book-barcode-resolver.service';
import type { BookBarcodeProvider } from './providers/book-provider.interface';
import { GoogleBooksProvider } from './providers/google-books.provider';
import { OpenLibraryProvider } from './providers/open-library.provider';
import type { BookProviderLookupResult } from './types/barcode-result.types';

function fakeConfigService(values: Record<string, unknown> = {}): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

const MATCH_RESULT: BookProviderLookupResult = {
  title: 'Dune',
  description: 'Synopsis.',
  book: {
    author: 'Frank Herbert',
    isbn: '9782070368228',
    publisher: 'Gallimard',
    publicationYear: 1970,
    language: 'fr',
    pageCount: 592,
    format: 'Hardcover',
  },
  coverUrl: 'https://example.test/cover.jpg',
};

function fakeProvider(
  id: 'google-books' | 'open-library',
  lookup: BookBarcodeProvider['lookup'],
): BookBarcodeProvider {
  return { id, lookup };
}

describe('BookBarcodeResolverService', () => {
  it('returns a matched response from the primary provider (Google Books) without touching the fallback', async () => {
    const googleBooksLookup = jest.fn().mockResolvedValue(MATCH_RESULT);
    const openLibraryLookup = jest.fn();
    const service = new BookBarcodeResolverService(
      fakeProvider('google-books', googleBooksLookup) as never,
      fakeProvider('open-library', openLibraryLookup) as never,
      new BarcodeCacheService(),
    );

    const response = await service.resolve('9782070368228');

    expect(response).toEqual({
      barcode: '9782070368228',
      category: 'book',
      status: 'matched',
      match: true,
      source: 'google-books',
      data: {
        title: 'Dune',
        description: 'Synopsis.',
        book: MATCH_RESULT.book,
        cd: null,
        dvd: null,
        countryCodes: null,
      },
      cover: { url: 'https://example.test/cover.jpg' },
    });
    expect(openLibraryLookup).not.toHaveBeenCalled();
  });

  it('falls back to Open Library when Google Books returns no exploitable result', async () => {
    const googleBooksLookup = jest.fn().mockResolvedValue(null);
    const openLibraryLookup = jest.fn().mockResolvedValue(MATCH_RESULT);
    const service = new BookBarcodeResolverService(
      fakeProvider('google-books', googleBooksLookup) as never,
      fakeProvider('open-library', openLibraryLookup) as never,
      new BarcodeCacheService(),
    );

    const response = await service.resolve('9782070368228');

    expect(response.status).toBe('matched');
    expect(response.source).toBe('open-library');
    expect(googleBooksLookup).toHaveBeenCalledWith('9782070368228');
    expect(openLibraryLookup).toHaveBeenCalledWith('9782070368228');
  });

  it('falls back to Open Library when Google Books throws (provider error), not just an empty result', async () => {
    const googleBooksLookup = jest.fn().mockRejectedValue(new Error('timeout'));
    const openLibraryLookup = jest.fn().mockResolvedValue(MATCH_RESULT);
    const service = new BookBarcodeResolverService(
      fakeProvider('google-books', googleBooksLookup) as never,
      fakeProvider('open-library', openLibraryLookup) as never,
      new BarcodeCacheService(),
    );

    const response = await service.resolve('9782070368228');

    expect(response.status).toBe('matched');
    expect(response.source).toBe('open-library');
  });

  it('returns no_match when both providers respond but neither has the book', async () => {
    const service = new BookBarcodeResolverService(
      fakeProvider('google-books', jest.fn().mockResolvedValue(null)) as never,
      fakeProvider('open-library', jest.fn().mockResolvedValue(null)) as never,
      new BarcodeCacheService(),
    );

    const response = await service.resolve('9782070368228');

    expect(response).toMatchObject({
      status: 'no_match',
      match: false,
      source: null,
      data: null,
      cover: null,
    });
  });

  it('returns no_match (not provider_error) when the fallback completes even though the primary errored', async () => {
    const service = new BookBarcodeResolverService(
      fakeProvider('google-books', jest.fn().mockRejectedValue(new Error('down'))) as never,
      fakeProvider('open-library', jest.fn().mockResolvedValue(null)) as never,
      new BarcodeCacheService(),
    );

    expect((await service.resolve('9782070368228')).status).toBe('no_match');
  });

  it('returns provider_error only when every provider in the chain throws', async () => {
    const service = new BookBarcodeResolverService(
      fakeProvider('google-books', jest.fn().mockRejectedValue(new Error('timeout'))) as never,
      fakeProvider('open-library', jest.fn().mockRejectedValue(new Error('timeout'))) as never,
      new BarcodeCacheService(),
    );

    const response = await service.resolve('9782070368228');
    expect(response).toMatchObject({
      status: 'provider_error',
      match: false,
      source: null,
      data: null,
    });
  });

  it('returns provider_error when Google Books fails and Open Library exhausts its retry (real providers, mocked fetch)', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    try {
      const service = new BookBarcodeResolverService(
        new GoogleBooksProvider(fakeConfigService()),
        new OpenLibraryProvider(fakeConfigService({ OPEN_LIBRARY_TIMEOUT_BUDGET_MS: 1000 })),
        new BarcodeCacheService(),
      );

      const response = await service.resolve('9782070368228');

      expect(response).toMatchObject({
        status: 'provider_error',
        match: false,
        source: null,
        data: null,
      });
      // Google Books : 1 tentative (pas de retry côté ce fournisseur) + Open Library : 2
      // tentatives (1 retry sur échec réseau) = 3 appels fetch au total.
      expect(global.fetch).toHaveBeenCalledTimes(3);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('returns no_match immediately, without calling any provider, for a barcode that is not ISBN-13 shaped', async () => {
    const googleBooksLookup = jest.fn();
    const service = new BookBarcodeResolverService(
      fakeProvider('google-books', googleBooksLookup) as never,
      fakeProvider('open-library', jest.fn()) as never,
      new BarcodeCacheService(),
    );

    // EAN-13 valide en forme mais ne commençant pas par 978/979 : pas un ISBN.
    const response = await service.resolve('4006381333931');

    expect(response.status).toBe('no_match');
    expect(googleBooksLookup).not.toHaveBeenCalled();
  });

  it('serves a matched result from cache on a second call, without hitting providers again', async () => {
    const googleBooksLookup = jest.fn().mockResolvedValue(MATCH_RESULT);
    const service = new BookBarcodeResolverService(
      fakeProvider('google-books', googleBooksLookup) as never,
      fakeProvider('open-library', jest.fn()) as never,
      new BarcodeCacheService(),
    );

    await service.resolve('9782070368228');
    await service.resolve('9782070368228');

    expect(googleBooksLookup).toHaveBeenCalledTimes(1);
  });

  it('does not cache a provider_error outcome — the next scan must retry the providers', async () => {
    const googleBooksLookup = jest.fn().mockRejectedValue(new Error('down'));
    const openLibraryLookup = jest.fn().mockRejectedValue(new Error('down'));
    const service = new BookBarcodeResolverService(
      fakeProvider('google-books', googleBooksLookup) as never,
      fakeProvider('open-library', openLibraryLookup) as never,
      new BarcodeCacheService(),
    );

    await service.resolve('9782070368228');
    await service.resolve('9782070368228');

    expect(googleBooksLookup).toHaveBeenCalledTimes(2);
  });
});
