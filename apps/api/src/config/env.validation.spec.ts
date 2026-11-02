import { collectEnvErrors, validateEnv } from './env.validation';

const STRONG_ACCESS = 'a'.repeat(32) + '-access';
const STRONG_REFRESH = 'b'.repeat(32) + '-refresh';

const devEnv = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  NODE_ENV: 'development',
  APP_ENV: 'development',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/notre_nid',
  JWT_ACCESS_SECRET: 'changeme_access_secret_dev_only',
  JWT_REFRESH_SECRET: 'changeme_refresh_secret_dev_only',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
  ...overrides,
});

const prodEnv = (overrides: Record<string, unknown> = {}): Record<string, unknown> =>
  devEnv({
    NODE_ENV: 'production',
    APP_ENV: 'production',
    DATABASE_URL: 'postgresql://u:p@db.example.com/neondb',
    JWT_ACCESS_SECRET: STRONG_ACCESS,
    JWT_REFRESH_SECRET: STRONG_REFRESH,
    STORAGE_DRIVER: 's3',
    STORAGE_BUCKET: 'bucket',
    STORAGE_ACCESS_KEY: 'key',
    STORAGE_SECRET_KEY: 'secret',
    STORAGE_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
    ...overrides,
  });

describe('environment validation', () => {
  it('accepts the documented development configuration (.env.example values)', () => {
    expect(collectEnvErrors(devEnv())).toEqual([]);
  });

  it('accepts a complete production configuration, without requiring optional provider keys', () => {
    expect(collectEnvErrors(prodEnv())).toEqual([]);
  });

  it('returns the configuration unchanged when valid', () => {
    const env = devEnv({ PORT: '3000' });
    expect(validateEnv(env)).toBe(env);
  });

  it.each([
    ['DATABASE_URL', { DATABASE_URL: undefined }],
    ['DATABASE_URL', { DATABASE_URL: 'mysql://u:p@h/db' }],
    ['JWT_ACCESS_SECRET', { JWT_ACCESS_SECRET: '' }],
    ['JWT_REFRESH_SECRET', { JWT_REFRESH_SECRET: undefined }],
    ['JWT_ACCESS_TTL', { JWT_ACCESS_TTL: '15 minutes' }],
    ['JWT_REFRESH_TTL', { JWT_REFRESH_TTL: undefined }],
    ['STORAGE_DRIVER', { STORAGE_DRIVER: 'ftp' }],
    ['STORAGE_BUCKET', { STORAGE_DRIVER: 's3' }],
    ['API_PUBLIC_URL', { API_PUBLIC_URL: '192.168.1.10:3000' }],
    ['PORT', { PORT: 'abc' }],
    ['SMTP_PORT', { SMTP_PORT: '70000' }],
    ['TRUST_PROXY_HOPS', { TRUST_PROXY_HOPS: 'true' }],
    ['LOG_LEVEL', { LOG_LEVEL: 'loud' }],
    ['APP_ENV', { APP_ENV: 'staging' }],
    ['DVD_PRODUCT_PROVIDER', { DVD_PRODUCT_PROVIDER: 'amazon' }],
  ])('rejects an invalid %s', (key, overrides) => {
    const errors = collectEnvErrors(devEnv(overrides));
    expect(errors.some((error) => error.startsWith(key))).toBe(true);
  });

  it('requires the Digit-Eyes keys only when Digit-Eyes is the selected DVD provider', () => {
    expect(collectEnvErrors(devEnv({ DVD_PRODUCT_PROVIDER: 'upcitemdb' }))).toEqual([]);
    expect(collectEnvErrors(devEnv({ DVD_PRODUCT_PROVIDER: 'digiteyes' }))).toEqual([
      'DIGITEYES_APP_KEY est obligatoire avec DVD_PRODUCT_PROVIDER=digiteyes.',
      'DIGITEYES_AUTH_KEY est obligatoire avec DVD_PRODUCT_PROVIDER=digiteyes.',
    ]);
    expect(
      collectEnvErrors(
        devEnv({
          DVD_PRODUCT_PROVIDER: 'DigitEyes',
          DIGITEYES_APP_KEY: 'k',
          DIGITEYES_AUTH_KEY: 's',
        }),
      ),
    ).toEqual([]);
  });

  describe('production hardening', () => {
    it('refuses example, short or identical JWT secrets', () => {
      expect(
        collectEnvErrors(prodEnv({ JWT_ACCESS_SECRET: 'changeme_access_secret_dev_only' })),
      ).toEqual(expect.arrayContaining([expect.stringContaining('valeur d’exemple')]));
      expect(collectEnvErrors(prodEnv({ JWT_REFRESH_SECRET: 'short' }))).toEqual(
        expect.arrayContaining([expect.stringContaining('au moins 32 caractères')]),
      );
      expect(collectEnvErrors(prodEnv({ JWT_REFRESH_SECRET: STRONG_ACCESS }))).toEqual(
        expect.arrayContaining([expect.stringContaining('doivent être différents')]),
      );
    });

    it('refuses local storage in production, but does not require API_PUBLIC_URL with s3', () => {
      expect(collectEnvErrors(prodEnv({ STORAGE_DRIVER: 'local' }))).toEqual(
        expect.arrayContaining([expect.stringContaining('STORAGE_DRIVER=local est interdit')]),
      );
      expect(collectEnvErrors(prodEnv({ API_PUBLIC_URL: undefined }))).toEqual([]);
    });

    it('treats NODE_ENV=production as production even without APP_ENV', () => {
      expect(
        collectEnvErrors(prodEnv({ APP_ENV: undefined, STORAGE_DRIVER: 'local' })),
      ).not.toEqual([]);
    });
  });

  it('lists every problem at once, by variable name, without ever echoing a value', () => {
    const secretValue = 'postgresql://user:super-secret@db.example.com/neondb';
    let message = '';
    try {
      validateEnv(
        prodEnv({
          DATABASE_URL: secretValue.replace('postgresql', 'mysql'),
          JWT_ACCESS_SECRET: 'tiny',
        }),
      );
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('l’API refuse de démarrer');
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('JWT_ACCESS_SECRET');
    expect(message).not.toContain('super-secret');
    expect(message).not.toContain('tiny');
  });
});
