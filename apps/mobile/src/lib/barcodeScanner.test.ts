import { normalizeScannedBarcode, SUPPORTED_BARCODE_TYPES } from './barcodeScanner';

describe('normalizeScannedBarcode', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeScannedBarcode('  9782070368228  ')).toBe('9782070368228');
  });

  it('strips internal spaces and non-digit characters', () => {
    expect(normalizeScannedBarcode('978-2 0703 68228')).toBe('9782070368228');
  });

  it('preserves a leading zero (never round-trips through Number)', () => {
    expect(normalizeScannedBarcode('012345678905')).toBe('012345678905');
  });

  it('leaves an already-clean code untouched', () => {
    expect(normalizeScannedBarcode('883929005559')).toBe('883929005559');
  });

  it('returns an empty string for a code with no digits at all', () => {
    expect(normalizeScannedBarcode('   ')).toBe('');
  });
});

describe('SUPPORTED_BARCODE_TYPES', () => {
  it('only enables product barcode formats (never QR/DataMatrix/etc.)', () => {
    expect(SUPPORTED_BARCODE_TYPES).toEqual(['ean13', 'ean8', 'upc_a', 'upc_e']);
  });
});
