import { positiveMsOrDefault } from './barcode-config.util';

describe('positiveMsOrDefault', () => {
  it('keeps a positive number or numeric string', () => {
    expect(positiveMsOrDefault(2500, 6000)).toBe(2500);
    expect(positiveMsOrDefault('2500', 6000)).toBe(2500);
  });

  it.each([undefined, '', '0', 0, '-5', 'abc'])(
    'falls back to the default for %p (never an immediate timeout)',
    (value) => {
      expect(positiveMsOrDefault(value, 6000)).toBe(6000);
    },
  );
});
