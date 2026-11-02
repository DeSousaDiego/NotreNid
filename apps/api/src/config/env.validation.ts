import { MAX_TRUST_PROXY_HOPS } from '../common/http/trust-proxy';
import { LOG_LEVELS } from '../common/logger/log-level';
import { parseDurationToMs } from '../common/utils/duration';
import { APP_ENVS, parseDatabaseTarget } from '../database-safety/database-safety';
import { DVD_PRODUCT_PROVIDER_VALUES } from '../items/barcode/providers/dvd-product-provider.factory';

/**
 * Validation centralisée de l'environnement, exécutée par ConfigModule AU DÉMARRAGE : une
 * configuration invalide empêche l'API de démarrer, au lieu de la laisser tourner puis
 * échouer au premier usage d'une fonctionnalité (Release 0B).
 *
 * - Indispensables : base, secrets et durées JWT, stockage actif.
 * - Optionnelles : jamais exigées tant que la fonctionnalité n'est pas sélectionnée
 *   (ex. clés Digit-Eyes seulement si DVD_PRODUCT_PROVIDER=digiteyes).
 * - Les durées des fournisseurs ne sont PAS bloquantes : une valeur invalide retombe sur le
 *   défaut (positiveMsOrDefault), comportement déjà documenté dans .env.example.
 *
 * Les messages ne citent que des NOMS de variables, jamais leur valeur.
 * La configuration est retournée inchangée (aucune conversion de type ici).
 */

/** Fragments présents dans les valeurs d'exemple (.env.example, CI) — refusés en production. */
const PLACEHOLDER_SECRET_FRAGMENTS = ['changeme', 'not_a_real_secret', 'dev_only'];
const MIN_PRODUCTION_SECRET_LENGTH = 32;

type RawEnv = Record<string, unknown>;

function str(env: RawEnv, key: string): string | undefined {
  const value = env[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  const text = String(value).trim();
  return text === '' ? undefined : text;
}

function isIntegerInRange(value: string, min: number, max: number): boolean {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function collectEnvErrors(env: RawEnv): string[] {
  const errors: string[] = [];
  const nodeEnv = str(env, 'NODE_ENV');
  const appEnv = str(env, 'APP_ENV');
  const isProduction = appEnv === 'production' || nodeEnv === 'production';

  if (nodeEnv && !['development', 'test', 'production'].includes(nodeEnv)) {
    errors.push('NODE_ENV doit valoir development, test ou production.');
  }
  if (appEnv && !(APP_ENVS as readonly string[]).includes(appEnv)) {
    errors.push(`APP_ENV doit valoir ${APP_ENVS.join(', ')}.`);
  }

  // --- Base de données ---
  if (!parseDatabaseTarget(str(env, 'DATABASE_URL'))) {
    errors.push('DATABASE_URL est absente ou n’est pas une URL PostgreSQL valide.');
  }

  // --- Authentification ---
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    const secret = str(env, key);
    if (!secret) {
      errors.push(`${key} est obligatoire.`);
      continue;
    }
    if (isProduction) {
      if (secret.length < MIN_PRODUCTION_SECRET_LENGTH) {
        errors.push(
          `${key} doit faire au moins ${MIN_PRODUCTION_SECRET_LENGTH} caractères en production.`,
        );
      }
      if (
        PLACEHOLDER_SECRET_FRAGMENTS.some((fragment) => secret.toLowerCase().includes(fragment))
      ) {
        errors.push(
          `${key} contient une valeur d’exemple : générez un secret dédié à la production.`,
        );
      }
    }
  }
  const accessSecret = str(env, 'JWT_ACCESS_SECRET');
  if (isProduction && accessSecret && accessSecret === str(env, 'JWT_REFRESH_SECRET')) {
    errors.push('JWT_ACCESS_SECRET et JWT_REFRESH_SECRET doivent être différents.');
  }
  for (const key of ['JWT_ACCESS_TTL', 'JWT_REFRESH_TTL']) {
    const ttl = str(env, key);
    if (!ttl) {
      errors.push(`${key} est obligatoire (ex. 15m, 30d).`);
      continue;
    }
    try {
      if (parseDurationToMs(ttl) <= 0) {
        errors.push(`${key} doit être une durée strictement positive (ex. 15m, 30d).`);
      }
    } catch {
      errors.push(`${key} n’est pas une durée valide (formats : 15m, 30d, 1h, 3600s).`);
    }
  }

  // --- Stockage ---
  const storageDriver = str(env, 'STORAGE_DRIVER') ?? 'local';
  if (storageDriver !== 'local' && storageDriver !== 's3') {
    errors.push('STORAGE_DRIVER doit valoir local ou s3.');
  }
  if (storageDriver === 's3') {
    for (const key of ['STORAGE_BUCKET', 'STORAGE_ACCESS_KEY', 'STORAGE_SECRET_KEY']) {
      if (!str(env, key)) {
        errors.push(`${key} est obligatoire avec STORAGE_DRIVER=s3.`);
      }
    }
    for (const key of ['STORAGE_ENDPOINT', 'STORAGE_PUBLIC_URL']) {
      const value = str(env, key);
      if (value && !isHttpUrl(value)) {
        errors.push(`${key} doit être une URL http(s).`);
      }
    }
  }
  if (storageDriver === 'local' && isProduction) {
    errors.push(
      'STORAGE_DRIVER=local est interdit en production (fichiers perdus à chaque redéploiement) : utilisez s3.',
    );
  }
  const apiPublicUrl = str(env, 'API_PUBLIC_URL');
  if (apiPublicUrl && !isHttpUrl(apiPublicUrl)) {
    errors.push('API_PUBLIC_URL doit être une URL http(s) absolue (ex. http://192.168.1.10:3000).');
  }

  // --- Fournisseurs optionnels ---
  const dvdProvider = str(env, 'DVD_PRODUCT_PROVIDER')?.toLowerCase();
  if (dvdProvider && !(DVD_PRODUCT_PROVIDER_VALUES as readonly string[]).includes(dvdProvider)) {
    errors.push(`DVD_PRODUCT_PROVIDER doit valoir ${DVD_PRODUCT_PROVIDER_VALUES.join(' ou ')}.`);
  }
  if (dvdProvider === 'digiteyes') {
    for (const key of ['DIGITEYES_APP_KEY', 'DIGITEYES_AUTH_KEY']) {
      if (!str(env, key)) {
        errors.push(`${key} est obligatoire avec DVD_PRODUCT_PROVIDER=digiteyes.`);
      }
    }
  }

  // --- Exploitation ---
  const port = str(env, 'PORT');
  if (port && !isIntegerInRange(port, 1, 65_535)) {
    errors.push('PORT doit être un entier entre 1 et 65535.');
  }
  const smtpPort = str(env, 'SMTP_PORT');
  if (smtpPort && !isIntegerInRange(smtpPort, 1, 65_535)) {
    errors.push('SMTP_PORT doit être un entier entre 1 et 65535.');
  }
  const trustProxy = str(env, 'TRUST_PROXY_HOPS');
  if (trustProxy && !isIntegerInRange(trustProxy, 0, MAX_TRUST_PROXY_HOPS)) {
    errors.push(`TRUST_PROXY_HOPS doit être un entier entre 0 et ${MAX_TRUST_PROXY_HOPS}.`);
  }
  const logLevel = str(env, 'LOG_LEVEL')?.toLowerCase();
  if (logLevel && !(LOG_LEVELS as readonly string[]).includes(logLevel)) {
    errors.push(`LOG_LEVEL doit valoir ${LOG_LEVELS.join(', ')}.`);
  }

  return errors;
}

/** Signature attendue par `ConfigModule.forRoot({ validate })`. */
export function validateEnv(env: RawEnv): RawEnv {
  const errors = collectEnvErrors(env);
  if (errors.length > 0) {
    throw new Error(
      `Configuration invalide — l’API refuse de démarrer :\n${errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }
  return env;
}
