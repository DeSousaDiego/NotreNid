import type { ConfigService } from '@nestjs/config';

import { BarcodeProviderError } from './barcode-provider.error';
import { GoogleBooksProvider } from './google-books.provider';

function fakeConfigService(values: Record<string, unknown> = {}): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('GoogleBooksProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('maps a full match into the normalized shape', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        totalItems: 1,
        items: [
          {
            volumeInfo: {
              title: 'Dune',
              authors: ['Frank Herbert'],
              description: "L'histoire de Paul Atréides.",
              publisher: 'Robert Laffont',
              publishedDate: '1965-08-01',
              language: 'fr',
              pageCount: 592,
              industryIdentifiers: [{ type: 'ISBN_13', identifier: '9782221224617' }],
              imageLinks: { thumbnail: 'http://books.google.com/cover.jpg' },
            },
          },
        ],
      }),
    );

    const provider = new GoogleBooksProvider(fakeConfigService());
    const result = await provider.lookup('9782221224617');

    expect(result).toEqual({
      title: 'Dune',
      description: "L'histoire de Paul Atréides.",
      book: {
        author: 'Frank Herbert',
        isbn: '9782221224617',
        publisher: 'Robert Laffont',
        publicationYear: 1965,
        language: 'fr',
        pageCount: 592,
        format: null,
      },
      coverUrl: 'https://books.google.com/cover.jpg',
    });
  });

  it('never sets a physical format — printType is not a reliable signal for it', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ totalItems: 1, items: [{ volumeInfo: { printType: 'BOOK' } }] }),
      );

    const provider = new GoogleBooksProvider(fakeConfigService());
    const result = await provider.lookup('9782070368228');

    expect(result?.book.format).toBeNull();
  });

  it('joins multiple authors into a single readable string', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        totalItems: 1,
        items: [{ volumeInfo: { authors: ['Auteur A', 'Auteur B'] } }],
      }),
    );

    const provider = new GoogleBooksProvider(fakeConfigService());
    const result = await provider.lookup('9782070368228');

    expect(result?.book.author).toBe('Auteur A, Auteur B');
  });

  it('falls back to the queried ISBN when Google Books does not echo an ISBN_13 identifier', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ totalItems: 1, items: [{ volumeInfo: {} }] }));

    const provider = new GoogleBooksProvider(fakeConfigService());
    const result = await provider.lookup('9782070368228');

    expect(result?.book.isbn).toBe('9782070368228');
  });

  it('never invents a value: every absent field maps to null, never a fabricated default', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ totalItems: 1, items: [{ volumeInfo: {} }] }));

    const provider = new GoogleBooksProvider(fakeConfigService());
    const result = await provider.lookup('9782070368228');

    expect(result).toMatchObject({
      title: null,
      description: null,
      coverUrl: null,
      book: {
        author: null,
        publisher: null,
        publicationYear: null,
        language: null,
        pageCount: null,
      },
    });
  });

  it('returns null when Google Books has no matching volume (totalItems: 0)', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ totalItems: 0, items: [] }));

    const provider = new GoogleBooksProvider(fakeConfigService());
    expect(await provider.lookup('9782070368228')).toBeNull();
  });

  it('throws a BarcodeProviderError on a non-OK HTTP status', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, false, 503));

    const provider = new GoogleBooksProvider(fakeConfigService());
    await expect(provider.lookup('9782070368228')).rejects.toBeInstanceOf(BarcodeProviderError);
  });

  it('throws a BarcodeProviderError on a network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    const provider = new GoogleBooksProvider(fakeConfigService());
    await expect(provider.lookup('9782070368228')).rejects.toBeInstanceOf(BarcodeProviderError);
  });

  it('throws a BarcodeProviderError when the response body is not valid JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('invalid json')),
    } as unknown as Response);

    const provider = new GoogleBooksProvider(fakeConfigService());
    await expect(provider.lookup('9782070368228')).rejects.toBeInstanceOf(BarcodeProviderError);
  });

  it('appends the API key to the request URL when configured', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ totalItems: 0, items: [] }));

    const provider = new GoogleBooksProvider(
      fakeConfigService({ GOOGLE_BOOKS_API_KEY: 'secret-key' }),
    );
    await provider.lookup('9782070368228');

    const requestedUrl = (global.fetch as jest.Mock).mock.calls[0][0] as URL;
    expect(requestedUrl.searchParams.get('key')).toBe('secret-key');
  });

  it('omits the key parameter entirely when no API key is configured', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ totalItems: 0, items: [] }));

    const provider = new GoogleBooksProvider(fakeConfigService());
    await provider.lookup('9782070368228');

    const requestedUrl = (global.fetch as jest.Mock).mock.calls[0][0] as URL;
    expect(requestedUrl.searchParams.has('key')).toBe(false);
  });
});
