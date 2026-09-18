import { isIsbn13Candidate, normalizeIsbnForLookup } from './barcode-validation.util';

describe('isIsbn13Candidate', () => {
  it('accepts an EAN-13 starting with 978', () => {
    expect(isIsbn13Candidate('9782070368228')).toBe(true);
  });

  it('accepts an EAN-13 starting with 979', () => {
    expect(isIsbn13Candidate('9791234567896')).toBe(true);
  });

  it('rejects an EAN-13 not starting with 978/979 (not a book barcode)', () => {
    expect(isIsbn13Candidate('4006381333931')).toBe(false);
  });

  it('rejects an 8-digit EAN-8 (too short to be an ISBN-13)', () => {
    expect(isIsbn13Candidate('96385074')).toBe(false);
  });

  it('rejects a 12-digit UPC-A (too short to be an ISBN-13)', () => {
    expect(isIsbn13Candidate('036000291452')).toBe(false);
  });
});

describe('normalizeIsbnForLookup', () => {
  it('returns the barcode unchanged (ISBN-13 is used as-is, no ISBN-10 conversion)', () => {
    expect(normalizeIsbnForLookup('9782070368228')).toBe('9782070368228');
  });
});
