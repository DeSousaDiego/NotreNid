import {
  assertDatabaseMatchesAppEnv,
  assertSafeDatabaseForDestructiveOperation,
  detectDestructivePrismaCommand,
  evaluateDestructiveDatabaseOperation,
  normalizeDatabaseHost,
  parseDatabaseTarget,
  type DatabaseSafetyEnv,
} from './database-safety';

const LOCAL_URL = 'postgresql://notre_nid:local_pw@localhost:5432/notre_nid?schema=public';
const NEON_POOLER_URL =
  'postgresql://owner:super-secret-pw@ep-prod-123-pooler.eu-central-1.aws.neon.tech/neondb';
const NEON_DIRECT_HOST = 'ep-prod-123.eu-central-1.aws.neon.tech';

function env(overrides: DatabaseSafetyEnv): DatabaseSafetyEnv {
  return { APP_ENV: 'development', NODE_ENV: 'development', DATABASE_URL: LOCAL_URL, ...overrides };
}

describe('database safety', () => {
  describe('parseDatabaseTarget', () => {
    it('keeps only host and database name', () => {
      expect(parseDatabaseTarget(NEON_POOLER_URL)).toEqual({
        host: 'ep-prod-123-pooler.eu-central-1.aws.neon.tech',
        database: 'neondb',
      });
    });

    it('rejects missing, malformed or non-postgres URLs', () => {
      expect(parseDatabaseTarget(undefined)).toBeNull();
      expect(parseDatabaseTarget('not a url')).toBeNull();
      expect(parseDatabaseTarget('mysql://u:p@localhost/db')).toBeNull();
    });

    it('unwraps an IPv6 literal host', () => {
      expect(parseDatabaseTarget('postgresql://u:p@[::1]:5432/db')?.host).toBe('::1');
    });
  });

  it('normalizes a Neon pooler host to its direct endpoint host', () => {
    expect(normalizeDatabaseHost('EP-PROD-123-POOLER.eu-central-1.aws.neon.tech')).toBe(
      NEON_DIRECT_HOST,
    );
  });

  describe('evaluateDestructiveDatabaseOperation', () => {
    it('allows a local database in development', () => {
      expect(evaluateDestructiveDatabaseOperation(env({}))).toEqual({
        allowed: true,
        target: 'localhost/notre_nid',
      });
    });

    it('allows the docker compose / CI service hosts in test', () => {
      const verdict = evaluateDestructiveDatabaseOperation(
        env({
          APP_ENV: 'test',
          DATABASE_URL: 'postgresql://u:p@postgres-test:5432/notre_nid_test',
        }),
      );
      expect(verdict.allowed).toBe(true);
    });

    it.each([
      ['APP_ENV missing', { APP_ENV: undefined }],
      ['APP_ENV blank', { APP_ENV: '  ' }],
      ['APP_ENV unknown', { APP_ENV: 'staging' }],
      ['APP_ENV production', { APP_ENV: 'production' }],
      ['NODE_ENV production', { NODE_ENV: 'production' }],
      ['DATABASE_URL missing', { DATABASE_URL: undefined }],
      ['DATABASE_URL malformed', { DATABASE_URL: 'nope' }],
    ])('refuses when %s', (_label, overrides: DatabaseSafetyEnv) => {
      expect(evaluateDestructiveDatabaseOperation(env(overrides)).allowed).toBe(false);
    });

    it('refuses a remote host that is not explicitly allowed, even outside production', () => {
      expect(
        evaluateDestructiveDatabaseOperation(env({ DATABASE_URL: NEON_POOLER_URL })).allowed,
      ).toBe(false);
    });

    it('allows a remote host explicitly listed in DESTRUCTIVE_DB_ALLOWED_HOSTS', () => {
      const verdict = evaluateDestructiveDatabaseOperation(
        env({ DATABASE_URL: NEON_POOLER_URL, DESTRUCTIVE_DB_ALLOWED_HOSTS: NEON_DIRECT_HOST }),
      );
      expect(verdict.allowed).toBe(true);
    });

    it('refuses a declared production host even if it is also listed as allowed or local', () => {
      expect(
        evaluateDestructiveDatabaseOperation(
          env({
            DATABASE_URL: NEON_POOLER_URL,
            PRODUCTION_DATABASE_HOSTS: ` other.example , ${NEON_DIRECT_HOST} `,
            DESTRUCTIVE_DB_ALLOWED_HOSTS: NEON_DIRECT_HOST,
          }),
        ).allowed,
      ).toBe(false);
      expect(
        evaluateDestructiveDatabaseOperation(env({ PRODUCTION_DATABASE_HOSTS: 'localhost' }))
          .allowed,
      ).toBe(false);
    });

    it('enforces a required APP_ENV', () => {
      expect(
        evaluateDestructiveDatabaseOperation(env({}), { requiredAppEnv: 'test' }).allowed,
      ).toBe(false);
      expect(
        evaluateDestructiveDatabaseOperation(env({ APP_ENV: 'test' }), { requiredAppEnv: 'test' })
          .allowed,
      ).toBe(true);
    });
  });

  describe('assertSafeDatabaseForDestructiveOperation', () => {
    it('returns the masked target when allowed', () => {
      expect(assertSafeDatabaseForDestructiveOperation('le seed', env({}))).toBe(
        'localhost/notre_nid',
      );
    });

    it('throws an explicit error that never contains credentials', () => {
      let message = '';
      try {
        assertSafeDatabaseForDestructiveOperation(
          'le seed',
          env({ DATABASE_URL: NEON_POOLER_URL, PRODUCTION_DATABASE_HOSTS: NEON_DIRECT_HOST }),
        );
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(/^Refus : le seed — exécution interdite sur une base de production/);
      expect(message).toContain('ep-prod-123-pooler.eu-central-1.aws.neon.tech/neondb');
      expect(message).not.toContain('super-secret-pw');
      expect(message).not.toContain('owner');
    });
  });

  describe('assertDatabaseMatchesAppEnv', () => {
    const prodEnv = { DATABASE_URL: NEON_POOLER_URL, PRODUCTION_DATABASE_HOSTS: NEON_DIRECT_HOST };

    it('refuses a non-production process connected to a declared production database', () => {
      expect(() => assertDatabaseMatchesAppEnv({ ...prodEnv, APP_ENV: 'development' })).toThrow(
        /Refus de démarrer/,
      );
      expect(() => assertDatabaseMatchesAppEnv(prodEnv)).toThrow(/non défini/);
    });

    it('lets production use its own database, and does nothing without a declared production host', () => {
      expect(() =>
        assertDatabaseMatchesAppEnv({ ...prodEnv, APP_ENV: 'production' }),
      ).not.toThrow();
      expect(() =>
        assertDatabaseMatchesAppEnv({ APP_ENV: 'development', DATABASE_URL: NEON_POOLER_URL }),
      ).not.toThrow();
    });
  });

  describe('detectDestructivePrismaCommand', () => {
    const argv = (...args: string[]) => [
      'node',
      '/repo/node_modules/prisma/build/index.js',
      ...args,
    ];

    it.each([
      [['migrate', 'reset', '--force'], 'prisma migrate reset'],
      [['migrate', 'dev', '--name', 'x'], 'prisma migrate dev'],
      [['db', 'push', '--accept-data-loss'], 'prisma db push'],
      [['db', 'execute', '--file', 'x.sql'], 'prisma db execute'],
    ])('detects %j', (args, expected) => {
      expect(detectDestructivePrismaCommand(argv(...args))).toBe(expected);
    });

    it.each([
      [['generate']],
      [['migrate', 'deploy']],
      [['migrate', 'status']],
      [['validate']],
      [['db', 'seed']],
    ])('ignores %j', (args) => {
      expect(detectDestructivePrismaCommand(argv(...args))).toBeNull();
    });
  });
});
