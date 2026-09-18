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

  it('requests the .json path — Open Library returns 404 on /api/books without it, regardless of format=json', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}));

    const provider = new OpenLibraryProvider(fakeConfigService());
    await provider.lookup('9782070368228');

    const requestedUrl = (global.fetch as jest.Mock).mock.calls[0][0] as URL;
    expect(requestedUrl.pathname).toBe('/api/books.json');
  });

  it('requests jscmd=details, not jscmd=data — physical_format/covers are absent from jscmd=data', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}));

    const provider = new OpenLibraryProvider(fakeConfigService());
    await provider.lookup('9782070368228');

    const requestedUrl = (global.fetch as jest.Mock).mock.calls[0][0] as URL;
    expect(requestedUrl.searchParams.get('jscmd')).toBe('details');
  });

  it('maps a full match into the normalized shape (jscmd=details, bibkey-scoped response)', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        'ISBN:9782070368228': {
          details: {
            title: 'Dune',
            authors: [{ name: 'Frank Herbert' }],
            publishers: ['Robert Laffont'],
            publish_date: '1965',
            number_of_pages: 592,
            covers: [1],
            physical_format: 'Hardcover',
          },
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
        format: 'Hardcover',
      },
      coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg',
    });
  });

  it('maps physical_format through as-is, without normalizing it (e.g. "Mass Market Paperback")', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        'ISBN:9782070368228': { details: { physical_format: 'Mass Market Paperback' } },
      }),
    );

    const provider = new OpenLibraryProvider(fakeConfigService());
    const result = await provider.lookup('9782070368228');

    expect(result?.book.format).toBe('Mass Market Paperback');
  });

  it('leaves format null when physical_format is absent — never invents a value', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ 'ISBN:9782070368228': { details: { title: 'Dune' } } }));

    const provider = new OpenLibraryProvider(fakeConfigService());
    const result = await provider.lookup('9782070368228');

    expect(result?.book.format).toBeNull();
  });

  it('joins multiple authors, skipping any without a name', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        'ISBN:9782070368228': {
          details: { authors: [{ name: 'Auteur A' }, {}, { name: 'Auteur B' }] },
        },
      }),
    );

    const provider = new OpenLibraryProvider(fakeConfigService());
    const result = await provider.lookup('9782070368228');

    expect(result?.book.author).toBe('Auteur A, Auteur B');
  });

  it('extracts a 4-digit year from an imprecise publish_date', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ 'ISBN:9782070368228': { details: { publish_date: 'May 1965' } } }),
      );

    const provider = new OpenLibraryProvider(fakeConfigService());
    const result = await provider.lookup('9782070368228');

    expect(result?.book.publicationYear).toBe(1965);
  });

  it('never fabricates description or language, which this endpoint does not provide', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ 'ISBN:9782070368228': { details: { title: 'Dune' } } }));

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

  it('returns null when the bibkey is present but its details block is missing', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ 'ISBN:9782070368228': {} }));

    const provider = new OpenLibraryProvider(fakeConfigService());
    expect(await provider.lookup('9782070368228')).toBeNull();
  });

  it('omits the cover entirely when no cover id is present', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ 'ISBN:9782070368228': { details: { title: 'Dune' } } }));

    const provider = new OpenLibraryProvider(fakeConfigService());
    const result = await provider.lookup('9782070368228');

    expect(result?.coverUrl).toBeNull();
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
