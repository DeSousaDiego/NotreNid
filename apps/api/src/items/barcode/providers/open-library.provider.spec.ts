import type { ConfigService } from '@nestjs/config';

import { BarcodeProviderError } from './barcode-provider.error';
import { OpenLibraryProvider } from './open-library.provider';

function fakeConfigService(values: Record<string, unknown> = {}): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: () => Promise.resolve(body) } as unknown as Response;
}

describe('OpenLibraryProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('maps a full match into the normalized shape (bibkey-scoped response)', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        'ISBN:9782070368228': {
          title: 'Dune',
          authors: [{ name: 'Frank Herbert' }],
          publishers: [{ name: 'Robert Laffont' }],
          publish_date: '1965',
          number_of_pages: 592,
          cover: { large: 'https://covers.openlibrary.org/b/id/1-L.jpg' },
        },
      }),
    );

    const provider = new OpenLibraryProvider(fakeConfigService());
    const result = await provider.lookup('9782070368228');

    expect(result).toEqual({
      title: 'Dune',
      description: null,
      book: {
        author: 'Frank Herbert',
        isbn: '9782070368228',
        publisher: 'Robert Laffont',
        publicationYear: 1965,
        language: null,
        pageCount: 592,
      },
      coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg',
    });
  });

  it('joins multiple authors, skipping any without a name', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        'ISBN:9782070368228': { authors: [{ name: 'Auteur A' }, {}, { name: 'Auteur B' }] },
      }),
    );

    const provider = new OpenLibraryProvider(fakeConfigService());
    const result = await provider.lookup('9782070368228');

    expect(result?.book.author).toBe('Auteur A, Auteur B');
  });

  it('extracts a 4-digit year from an imprecise publish_date', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ 'ISBN:9782070368228': { publish_date: 'May 1965' } }));

    const provider = new OpenLibraryProvider(fakeConfigService());
    const result = await provider.lookup('9782070368228');

    expect(result?.book.publicationYear).toBe(1965);
  });

  it('never fabricates description or language, which this endpoint does not provide', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ 'ISBN:9782070368228': { title: 'Dune' } }));

    const provider = new OpenLibraryProvider(fakeConfigService());
    const result = await provider.lookup('9782070368228');

    expect(result?.description).toBeNull();
    expect(result?.book.language).toBeNull();
  });

  it('returns null when the bibkey is absent from the response (no match)', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}));

    const provider = new OpenLibraryProvider(fakeConfigService());
    expect(await provider.lookup('9782070368228')).toBeNull();
  });

  it('throws a BarcodeProviderError on a non-OK HTTP status', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, false, 503));

    const provider = new OpenLibraryProvider(fakeConfigService());
    await expect(provider.lookup('9782070368228')).rejects.toBeInstanceOf(BarcodeProviderError);
  });

  it('throws a BarcodeProviderError on a network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    const provider = new OpenLibraryProvider(fakeConfigService());
    await expect(provider.lookup('9782070368228')).rejects.toBeInstanceOf(BarcodeProviderError);
  });
});
