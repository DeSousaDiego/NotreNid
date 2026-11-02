import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { parse as parseDotenv } from 'dotenv';

import {
  assertSafeDatabaseForDestructiveOperation,
  describeDatabaseTarget,
  parseDatabaseTarget,
} from '../src/database-safety/database-safety';

/**
 * Environnement des tests d'intégration (e2e) et de la préparation de leur base.
 *
 * Règle centrale : la base de test vient UNIQUEMENT de `DATABASE_URL_TEST` (variable
 * d'environnement, puis .env racine), avec pour défaut le service `postgres-test` de
 * docker-compose.yml. Jamais de `DATABASE_URL` : c'est la base de DEV en local, et elle a
 * déjà été la production par erreur (docs/PHASE_STATUS.md, Release 0A).
 *
 * Le reste du .env de dev n'est pas chargé non plus (stockage R2, clés fournisseurs…) :
 * `AppModule` ignore le fichier .env quand APP_ENV=test.
 */
export const DEFAULT_TEST_DATABASE_URL =
  'postgresql://notre_nid:notre_nid_test_password@localhost:5433/notre_nid_test?schema=public';

const ROOT_ENV_FILE = path.resolve(__dirname, '../../../.env');

/** Valeurs de test non secrètes, utilisées seulement si l'environnement (CI) ne les fournit pas. */
const TEST_DEFAULTS: Record<string, string> = {
  PORT: '3000',
  JWT_ACCESS_SECRET: 'test_access_secret_not_a_real_secret',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_SECRET: 'test_refresh_secret_not_a_real_secret',
  JWT_REFRESH_TTL: '30d',
  CORS_ORIGINS: 'http://localhost:8081',
  API_PUBLIC_URL: 'http://localhost:3000',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_FROM: 'Notre Nid <no-reply@notre-nid.local>',
};

function readRootEnvFile(): Record<string, string> {
  return existsSync(ROOT_ENV_FILE) ? parseDotenv(readFileSync(ROOT_ENV_FILE)) : {};
}

/**
 * Calcule les variables à imposer pour un processus de test, à partir de `source`
 * (process.env) et du .env racine (seules quelques clés y sont lues).
 */
export function buildTestEnvironment(
  source: NodeJS.ProcessEnv = process.env,
  rootEnvFile: Record<string, string> = readRootEnvFile(),
): Record<string, string> {
  const pick = (key: string): string | undefined => source[key] ?? rootEnvFile[key];

  const environment: Record<string, string> = {
    ...TEST_DEFAULTS,
    APP_ENV: 'test',
    NODE_ENV: 'test',
    DATABASE_URL: pick('DATABASE_URL_TEST') ?? DEFAULT_TEST_DATABASE_URL,
    // Jamais de stockage distant en test : les fichiers vont dans apps/api/storage/uploads (ignoré par Git).
    STORAGE_DRIVER: 'local',
    PRODUCTION_DATABASE_HOSTS: pick('PRODUCTION_DATABASE_HOSTS') ?? '',
    DESTRUCTIVE_DB_ALLOWED_HOSTS: pick('DESTRUCTIVE_DB_ALLOWED_HOSTS') ?? '',
  };
  for (const key of Object.keys(TEST_DEFAULTS)) {
    const provided = source[key];
    if (provided !== undefined) {
      environment[key] = provided;
    }
  }
  return environment;
}

/**
 * Vérifie que l'environnement de test cible une base autorisée ET distincte de la base de
 * développement déclarée dans le .env racine. Lève une erreur sinon ; retourne la cible masquée.
 */
export function assertSafeTestEnvironment(
  operation: string,
  environment: Record<string, string>,
  rootEnvFile: Record<string, string> = readRootEnvFile(),
): string {
  const target = assertSafeDatabaseForDestructiveOperation(operation, environment, {
    requiredAppEnv: 'test',
  });

  const testTarget = parseDatabaseTarget(environment['DATABASE_URL']);
  const devTarget = parseDatabaseTarget(rootEnvFile['DATABASE_URL']);
  if (
    testTarget &&
    devTarget &&
    describeDatabaseTarget(testTarget) === describeDatabaseTarget(devTarget) &&
    portOf(environment['DATABASE_URL']) === portOf(rootEnvFile['DATABASE_URL'])
  ) {
    throw new Error(
      `Refus : ${operation} ciblerait la base de développement (${target}). ` +
        'Renseignez DATABASE_URL_TEST vers une base dédiée aux tests.',
    );
  }
  return target;
}

function portOf(url: string | undefined): string {
  try {
    return url ? new URL(url).port || '5432' : '';
  } catch {
    return '';
  }
}
