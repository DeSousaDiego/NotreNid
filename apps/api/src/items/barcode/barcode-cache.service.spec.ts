import { BarcodeCacheService } from './barcode-cache.service';
import type { BarcodeResolveResponse } from './types/barcode-result.types';

const SAMPLE: BarcodeResolveResponse = {
  barcode: '9782070368228',
  category: 'book',
  status: 'matched',
  match: true,
  source: 'google-books',
  data: { title: 'Dune', description: null, book: null },
  cover: null,
};

describe('BarcodeCacheService', () => {
  let service: BarcodeCacheService;

  beforeEach(() => {
    service = new BarcodeCacheService();
  });

  it('returns undefined for a key never set', () => {
    expect(service.get('book', '9782070368228')).toBeUndefined();
  });

  it('returns the cached value before expiry', () => {
    service.set('book', '9782070368228', SAMPLE, 60_000);
    expect(service.get('book', '9782070368228')).toEqual(SAMPLE);
  });

  it('keys are scoped by category — the same barcode under a different category misses', () => {
    service.set('book', '9782070368228', SAMPLE, 60_000);
    expect(service.get('cd', '9782070368228')).toBeUndefined();
  });

  it('expires an entry past its TTL', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    service.set('book', '9782070368228', SAMPLE, 1_000);
    nowSpy.mockReturnValue(1_000_000 + 1_001);

    expect(service.get('book', '9782070368228')).toBeUndefined();
    nowSpy.mockRestore();
  });

  it('overwrites a previous entry for the same key', () => {
    service.set('book', '9782070368228', SAMPLE, 60_000);
    const updated: BarcodeResolveResponse = { ...SAMPLE, status: 'no_match', match: false };
    service.set('book', '9782070368228', updated, 60_000);

    expect(service.get('book', '9782070368228')).toEqual(updated);
  });
});
