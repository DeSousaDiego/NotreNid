import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { DigitEyesProvider } from './digit-eyes.provider';
import { selectDvdProductProvider } from './dvd-product-provider.factory';
import type { UpcItemDbProvider } from './upcitemdb.provider';

const upcItemDb = { id: 'upcitemdb' } as unknown as UpcItemDbProvider;
const digitEyes = { id: 'digiteyes' } as unknown as DigitEyesProvider;

function config(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

const DIGITEYES_KEYS = { DIGITEYES_APP_KEY: 'x', DIGITEYES_AUTH_KEY: 'y' };

describe('selectDvdProductProvider', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('DVD_PRODUCT_PROVIDER=upcitemdb → UPCitemdb', () => {
    expect(
      selectDvdProductProvider(config({ DVD_PRODUCT_PROVIDER: 'upcitemdb' }), upcItemDb, digitEyes),
    ).toBe(upcItemDb);
  });

  it('DVD_PRODUCT_PROVIDER=digiteyes (with credentials) → Digit-Eyes', () => {
    expect(
      selectDvdProductProvider(
        config({ DVD_PRODUCT_PROVIDER: 'digiteyes', ...DIGITEYES_KEYS }),
        upcItemDb,
        digitEyes,
      ),
    ).toBe(digitEyes);
  });

  it('is case/whitespace tolerant', () => {
    expect(
      selectDvdProductProvider(
        config({ DVD_PRODUCT_PROVIDER: ' DigitEyes ', ...DIGITEYES_KEYS }),
        upcItemDb,
        digitEyes,
      ),
    ).toBe(digitEyes);
  });

  it('defaults to UPCitemdb when the variable is unset (historical behaviour)', () => {
    expect(selectDvdProductProvider(config({}), upcItemDb, digitEyes)).toBe(upcItemDb);
  });

  it('refuses an unknown value with an explicit configuration error', () => {
    expect(() =>
      selectDvdProductProvider(config({ DVD_PRODUCT_PROVIDER: 'go-upc' }), upcItemDb, digitEyes),
    ).toThrow(/DVD_PRODUCT_PROVIDER="go-upc".*upcitemdb, digiteyes/);
  });

  it('refuses digiteyes without its credentials, naming the missing variables only', () => {
    expect(() =>
      selectDvdProductProvider(
        config({ DVD_PRODUCT_PROVIDER: 'digiteyes', DIGITEYES_APP_KEY: 'x' }),
        upcItemDb,
        digitEyes,
      ),
    ).toThrow('Configuration invalide : DVD_PRODUCT_PROVIDER=digiteyes exige DIGITEYES_AUTH_KEY.');
  });

  it('treats a whitespace-only credential as missing', () => {
    expect(() =>
      selectDvdProductProvider(
        config({
          DVD_PRODUCT_PROVIDER: 'digiteyes',
          DIGITEYES_APP_KEY: 'x',
          DIGITEYES_AUTH_KEY: '  ',
        }),
        upcItemDb,
        digitEyes,
      ),
    ).toThrow(/DIGITEYES_AUTH_KEY/);
  });
});
