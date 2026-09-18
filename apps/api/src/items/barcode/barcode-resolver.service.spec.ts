import { BarcodeResolverService } from './barcode-resolver.service';
import type { BookBarcodeResolverService } from './book-barcode-resolver.service';
import type { BarcodeResolveResponse } from './types/barcode-result.types';

describe('BarcodeResolverService', () => {
  it('delegates to the book resolver for category "book"', async () => {
    const bookResponse: BarcodeResolveResponse = {
      barcode: '9782070368228',
      category: 'book',
      status: 'matched',
      match: true,
      source: 'google-books',
      data: { title: 'Dune', description: null, book: null },
      cover: null,
    };
    const resolve = jest.fn().mockResolvedValue(bookResponse);
    const service = new BarcodeResolverService({
      resolve,
    } as unknown as BookBarcodeResolverService);

    const result = await service.resolve({ barcode: '9782070368228', category: 'book' });

    expect(resolve).toHaveBeenCalledWith('9782070368228');
    expect(result).toBe(bookResponse);
  });

  it('returns an explicit "unsupported" status for cd, without calling the book resolver', async () => {
    const resolve = jest.fn();
    const service = new BarcodeResolverService({
      resolve,
    } as unknown as BookBarcodeResolverService);

    const result = await service.resolve({ barcode: '036000291452', category: 'cd' });

    expect(resolve).not.toHaveBeenCalled();
    expect(result).toEqual({
      barcode: '036000291452',
      category: 'cd',
      status: 'unsupported',
      match: false,
      source: null,
      data: null,
      cover: null,
    });
  });

  it('returns an explicit "unsupported" status for dvd — never a fabricated match', async () => {
    const service = new BarcodeResolverService({
      resolve: jest.fn(),
    } as unknown as BookBarcodeResolverService);

    const result = await service.resolve({ barcode: '036000291452', category: 'dvd' });

    expect(result.status).toBe('unsupported');
    expect(result.match).toBe(false);
    expect(result.data).toBeNull();
  });
});
