import { BarcodeResolverService } from './barcode-resolver.service';
import type { BookBarcodeResolverService } from './book-barcode-resolver.service';
import type { CdBarcodeResolverService } from './cd-barcode-resolver.service';
import type { BarcodeResolveResponse } from './types/barcode-result.types';

function makeService(
  bookResolve: jest.Mock = jest.fn(),
  cdResolve: jest.Mock = jest.fn(),
): BarcodeResolverService {
  return new BarcodeResolverService(
    { resolve: bookResolve } as unknown as BookBarcodeResolverService,
    { resolve: cdResolve } as unknown as CdBarcodeResolverService,
  );
}

describe('BarcodeResolverService', () => {
  it('delegates to the book resolver for category "book"', async () => {
    const bookResponse: BarcodeResolveResponse = {
      barcode: '9782070368228',
      category: 'book',
      status: 'matched',
      match: true,
      source: 'google-books',
      data: { title: 'Dune', description: null, book: null, cd: null },
      cover: null,
    };
    const bookResolve = jest.fn().mockResolvedValue(bookResponse);
    const cdResolve = jest.fn();
    const service = makeService(bookResolve, cdResolve);

    const result = await service.resolve({ barcode: '9782070368228', category: 'book' });

    expect(bookResolve).toHaveBeenCalledWith('9782070368228');
    expect(cdResolve).not.toHaveBeenCalled();
    expect(result).toBe(bookResponse);
  });

  it('delegates to the cd resolver for category "cd"', async () => {
    const cdResponse: BarcodeResolveResponse = {
      barcode: '5099969236424',
      category: 'cd',
      status: 'matched',
      match: true,
      source: 'musicbrainz',
      data: {
        title: 'Discovery',
        description: null,
        book: null,
        cd: {
          artist: 'Daft Punk',
          releaseYear: 2001,
          label: 'Daft Life',
          format: 'CD',
          artistCountry: null,
        },
      },
      cover: null,
    };
    const bookResolve = jest.fn();
    const cdResolve = jest.fn().mockResolvedValue(cdResponse);
    const service = makeService(bookResolve, cdResolve);

    const result = await service.resolve({ barcode: '5099969236424', category: 'cd' });

    expect(cdResolve).toHaveBeenCalledWith('5099969236424');
    expect(bookResolve).not.toHaveBeenCalled();
    expect(result).toBe(cdResponse);
  });

  it('returns an explicit "unsupported" status for dvd — never a fabricated match', async () => {
    const bookResolve = jest.fn();
    const cdResolve = jest.fn();
    const service = makeService(bookResolve, cdResolve);

    const result = await service.resolve({ barcode: '036000291452', category: 'dvd' });

    expect(bookResolve).not.toHaveBeenCalled();
    expect(cdResolve).not.toHaveBeenCalled();
    expect(result).toEqual({
      barcode: '036000291452',
      category: 'dvd',
      status: 'unsupported',
      match: false,
      source: null,
      data: null,
      cover: null,
    });
  });
});
