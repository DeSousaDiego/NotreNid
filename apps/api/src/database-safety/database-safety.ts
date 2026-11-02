/**
 * Garde-fou commun contre toute opération destructive (seed, reset, `prisma migrate dev`,
 * tests e2e…) visant une base qui pourrait être la production.
 *
 * Volontairement sans dépendance Nest/Prisma : importé à la fois par l'API, par
 * `prisma.config.ts`, par `prisma/seed.ts`, par `scripts/db-safe.ts` et par le setup des
 * tests e2e — une seule logique, jamais de `if` divergents d'un script à l'autre.
 *
 * Principe : conservateur. Une opération destructive n'est autorisée que si TOUS les
 * signaux concordent (environnement déclaré explicitement non-production, base non
 * déclarée production, hôte local ou explicitement autorisé). Le moindre doute → refus.
 *
 * Les messages n'incluent jamais d'identifiant de connexion : uniquement l'hôte et le nom
 * de base (voir `describeDatabaseTarget`).
 */

export const APP_ENVS = ['development', 'test', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/** Hôtes considérés comme locaux (machine du développeur ou réseau docker compose / CI). */
const LOCAL_DATABASE_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'postgres',
  'postgres-test',
  'host.docker.internal',
]);

export interface DatabaseSafetyEnv {
  APP_ENV?: string;
  NODE_ENV?: string;
  DATABASE_URL?: string;
  /** Hôtes des bases de production, séparés par des virgules (jamais de credentials). */
  PRODUCTION_DATABASE_HOSTS?: string;
  /** Hôtes distants explicitement autorisés pour une opération destructive (ex. branche Neon de dev). */
  DESTRUCTIVE_DB_ALLOWED_HOSTS?: string;
}

export interface DatabaseTarget {
  host: string;
  database: string;
}

export type DestructiveOperationVerdict =
  { allowed: true; target: string } | { allowed: false; reason: string };

export function isAppEnv(value: string | undefined): value is AppEnv {
  return (APP_ENVS as readonly string[]).includes(value ?? '');
}

export function parseDatabaseTarget(url: string | undefined): DatabaseTarget | null {
  if (!url) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    return null;
  }
  // `URL.hostname` garde les crochets d'une IPv6 littérale (`[::1]`).
  const host = parsed.hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');
  if (!host) {
    return null;
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  return { host, database: database || '(défaut)' };
}

/** Représentation affichable d'une cible : hôte et nom de base, jamais d'utilisateur ni de mot de passe. */
export function describeDatabaseTarget(target: DatabaseTarget): string {
  return `${target.host}/${target.database}`;
}

/**
 * Neon expose la même base sous deux hôtes (`ep-xxx-pooler.…` pour le pooler,
 * `ep-xxx.…` pour la connexion directe) : on compare donc l'identifiant d'endpoint.
 */
export function normalizeDatabaseHost(host: string): string {
  const [first = '', ...rest] = host.toLowerCase().split('.');
  return [first.replace(/-pooler$/, ''), ...rest].join('.');
}

function parseHostList(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map(normalizeDatabaseHost),
  );
}

export function isDeclaredProductionDatabase(env: DatabaseSafetyEnv): boolean {
  const target = parseDatabaseTarget(env.DATABASE_URL);
  if (!target) {
    return false;
  }
  return parseHostList(env.PRODUCTION_DATABASE_HOSTS).has(normalizeDatabaseHost(target.host));
}

export function evaluateDestructiveDatabaseOperation(
  env: DatabaseSafetyEnv,
  options: { requiredAppEnv?: Exclude<AppEnv, 'production'> } = {},
): DestructiveOperationVerdict {
  const appEnv = env.APP_ENV?.trim();
  if (!appEnv) {
    return {
      allowed: false,
      reason:
        "APP_ENV n'est pas défini : impossible d'établir que la base n'est pas la production.",
    };
  }
  if (!isAppEnv(appEnv)) {
    return {
      allowed: false,
      reason: `APP_ENV="${appEnv}" n'est pas reconnu (valeurs : ${APP_ENVS.join(', ')}).`,
    };
  }
  if (appEnv === 'production') {
    return { allowed: false, reason: 'APP_ENV=production.' };
  }
  if (options.requiredAppEnv && appEnv !== options.requiredAppEnv) {
    return {
      allowed: false,
      reason: `cette opération exige APP_ENV=${options.requiredAppEnv} (reçu : ${appEnv}).`,
    };
  }
  if (env.NODE_ENV === 'production') {
    return { allowed: false, reason: 'NODE_ENV=production.' };
  }

  const target = parseDatabaseTarget(env.DATABASE_URL);
  if (!target) {
    return { allowed: false, reason: 'DATABASE_URL est absente ou illisible.' };
  }
  const description = describeDatabaseTarget(target);

  if (isDeclaredProductionDatabase(env)) {
    return {
      allowed: false,
      reason: `la base ${description} est déclarée comme production (PRODUCTION_DATABASE_HOSTS).`,
    };
  }
  if (LOCAL_DATABASE_HOSTS.has(target.host)) {
    return { allowed: true, target: description };
  }
  if (parseHostList(env.DESTRUCTIVE_DB_ALLOWED_HOSTS).has(normalizeDatabaseHost(target.host))) {
    return { allowed: true, target: description };
  }
  return {
    allowed: false,
    reason:
      `l'hôte distant ${target.host} n'est pas explicitement autorisé. S'il s'agit d'une base ` +
      'de développement ou de test, ajoutez-le à DESTRUCTIVE_DB_ALLOWED_HOSTS.',
  };
}

export class DestructiveOperationRefusedError extends Error {
  constructor(operation: string, reason: string) {
    super(
      `Refus : ${operation} — exécution interdite sur une base de production ou non vérifiée. ` +
        `Raison : ${reason}`,
    );
    this.name = 'DestructiveOperationRefusedError';
  }
}

/**
 * Lève une erreur explicite si `env` ne permet pas d'établir avec certitude que la base
 * ciblée peut subir `operation`. Retourne la description (hôte/base) de la cible autorisée.
 */
export function assertSafeDatabaseForDestructiveOperation(
  operation: string,
  env: DatabaseSafetyEnv = process.env,
  options: { requiredAppEnv?: Exclude<AppEnv, 'production'> } = {},
): string {
  const verdict = evaluateDestructiveDatabaseOperation(env, options);
  if (!verdict.allowed) {
    throw new DestructiveOperationRefusedError(operation, verdict.reason);
  }
  return verdict.target;
}

/**
 * Au démarrage de l'API : un processus qui ne se déclare pas production ne doit jamais se
 * connecter à une base déclarée production (cas typique : `.env` local resté sur Neon).
 * Sans PRODUCTION_DATABASE_HOSTS renseignée, ce contrôle ne peut rien établir et laisse passer.
 */
export function assertDatabaseMatchesAppEnv(env: DatabaseSafetyEnv = process.env): void {
  if (env.APP_ENV === 'production' || !isDeclaredProductionDatabase(env)) {
    return;
  }
  const target = parseDatabaseTarget(env.DATABASE_URL);
  throw new Error(
    `Refus de démarrer : APP_ENV=${env.APP_ENV ?? '(non défini)'} mais DATABASE_URL cible une ` +
      `base déclarée production (${target ? describeDatabaseTarget(target) : 'inconnue'}).`,
  );
}

/** Sous-commandes Prisma susceptibles de détruire ou réécrire des données. */
const DESTRUCTIVE_PRISMA_COMMANDS: ReadonlyArray<readonly [string, string]> = [
  ['migrate', 'reset'],
  ['migrate', 'dev'],
  ['db', 'push'],
  ['db', 'execute'],
];

/**
 * Retourne la sous-commande Prisma destructive présente dans `argv` (ex. `migrate reset`),
 * ou `null`. Utilisé par `prisma.config.ts`, chargé par CHAQUE commande du CLI Prisma : un
 * `prisma migrate reset` lancé à la main est donc protégé au même titre que les scripts.
 */
export function detectDestructivePrismaCommand(argv: readonly string[]): string | null {
  const positional = argv.slice(2).filter((arg) => !arg.startsWith('-'));
  for (const [group, command] of DESTRUCTIVE_PRISMA_COMMANDS) {
    const index = positional.indexOf(group);
    if (index !== -1 && positional[index + 1] === command) {
      return `prisma ${group} ${command}`;
    }
  }
  return null;
}
