import { BarcodeResolverService } from './barcode-resolver.service';
import type { BookBarcodeResolverService } from './book-barcode-resolver.service';
import type { CdBarcodeResolverService } from './cd-barcode-resolver.service';
import type { ResolveBarcodeDto } from './dto/resolve-barcode.dto';
import type { DvdBarcodeResolverService } from './dvd-barcode-resolver.service';
import type { BarcodeResolveResponse } from './types/barcode-result.types';

function makeService(
  bookResolve: jest.Mock = jest.fn(),
  cdResolve: jest.Mock = jest.fn(),
  dvdResolve: jest.Mock = jest.fn(),
): BarcodeResolverService {
  return new BarcodeResolverService(
    { resolve: bookResolve } as unknown as BookBarcodeResolverService,
    { resolve: cdResolve } as unknown as CdBarcodeResolverService,
    { resolve: dvdResolve } as unknown as DvdBarcodeResolverService,
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
      data: {
        title: 'Dune',
        description: null,
        book: null,
        cd: null,
        dvd: null,
        countryCodes: null,
      },
      cover: null,
    };
    const bookResolve = jest.fn().mockResolvedValue(bookResponse);
    const cdResolve = jest.fn();
    const dvdResolve = jest.fn();
    const service = makeService(bookResolve, cdResolve, dvdResolve);

    const result = await service.resolve({ barcode: '9782070368228', category: 'book' });

    expect(bookResolve).toHaveBeenCalledWith('9782070368228');
    expect(cdResolve).not.toHaveBeenCalled();
    expect(dvdResolve).not.toHaveBeenCalled();
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
        dvd: null,
        countryCodes: null,
      },
      cover: null,
    };
    const bookResolve = jest.fn();
    const cdResolve = jest.fn().mockResolvedValue(cdResponse);
    const dvdResolve = jest.fn();
    const service = makeService(bookResolve, cdResolve, dvdResolve);

    const result = await service.resolve({ barcode: '5099969236424', category: 'cd' });

    expect(cdResolve).toHaveBeenCalledWith('5099969236424');
    expect(bookResolve).not.toHaveBeenCalled();
    expect(dvdResolve).not.toHaveBeenCalled();
    expect(result).toBe(cdResponse);
  });

  it('delegates to the dvd resolver for category "dvd" — no longer a fabricated "unsupported"', async () => {
    const dvdResponse: BarcodeResolveResponse = {
      barcode: '786936815481',
      category: 'dvd',
      status: 'matched',
      match: true,
      source: 'upcitemdb',
      data: {
        title: "Pirates of the Caribbean: At World's End",
        description: 'After losing Captain Jack Sparrow...',
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
    };
    const bookResolve = jest.fn();
    const cdResolve = jest.fn();
    const dvdResolve = jest.fn().mockResolvedValue(dvdResponse);
    const service = makeService(bookResolve, cdResolve, dvdResolve);

    const result = await service.resolve({ barcode: '786936815481', category: 'dvd' });

    expect(dvdResolve).toHaveBeenCalledWith('786936815481');
    expect(bookResolve).not.toHaveBeenCalled();
    expect(cdResolve).not.toHaveBeenCalled();
    expect(result).toBe(dvdResponse);
  });

  it('returns an explicit "unsupported" status as a defensive fallback for a category outside BARCODE_CATEGORIES', async () => {
    // `book`/`cd`/`dvd` sont tous les trois câblés désormais — ce test cible
    // le filet de sécurité restant dans `BarcodeResolverService.resolve`,
    // volontairement conservé pour une future catégorie ajoutée à
    // `BARCODE_CATEGORIES` sans `case` correspondant câblé ici. Un cast est
    // nécessaire : plus aucune vraie valeur de `BarcodeCategory` ne peut
    // atteindre ce chemin.
    const bookResolve = jest.fn();
    const cdResolve = jest.fn();
    const dvdResolve = jest.fn();
    const service = makeService(bookResolve, cdResolve, dvdResolve);
    const dto = { barcode: '036000291452', category: 'vinyl' } as unknown as ResolveBarcodeDto;

    const result = await service.resolve(dto);

    expect(bookResolve).not.toHaveBeenCalled();
    expect(cdResolve).not.toHaveBeenCalled();
    expect(dvdResolve).not.toHaveBeenCalled();
    expect(result).toEqual({
      barcode: '036000291452',
      category: 'vinyl',
      status: 'unsupported',
      match: false,
      source: null,
      data: null,
      cover: null,
    });
  });
});
