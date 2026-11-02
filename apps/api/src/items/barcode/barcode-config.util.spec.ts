import { MAX_CONFIG_DURATION_MS, positiveMsOrDefault } from './barcode-config.util';

describe('positiveMsOrDefault', () => {
  it('converts a numeric string from the environment into a real number', () => {
    const value = positiveMsOrDefault('8000', 6000);
    expect(value).toBe(8000);
    expect(typeof value).toBe('number');
    // Garde-fou du bug d'origine : une addition, jamais une concaténation.
    expect(1_000 + value).toBe(9_000);
  });

  it('keeps a programmatic positive number, and tolerates surrounding spaces', () => {
    expect(positiveMsOrDefault(8000, 6000)).toBe(8000);
    expect(positiveMsOrDefault(' 2500 ', 6000)).toBe(2500);
  });

  it.each([undefined, '', '   ', '0', 0, '-5', -5, 'abc', 'NaN', 'Infinity'])(
    'falls back to the default for %p (never an immediate or infinite timeout)',
    (value) => {
      expect(positiveMsOrDefault(value, 6000)).toBe(6000);
    },
  );

  it('caps an excessive value instead of letting Node turn it into a 1 ms timeout', () => {
    expect(positiveMsOrDefault('99999999999', 6000)).toBe(MAX_CONFIG_DURATION_MS);
    expect(positiveMsOrDefault(MAX_CONFIG_DURATION_MS, 6000)).toBe(MAX_CONFIG_DURATION_MS);
  });
});
