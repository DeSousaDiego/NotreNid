/**
 * Valeurs acceptées pour LOG_LEVEL (niveaux Nest, `info` = alias de `log`). Un niveau
 * active lui-même et tous les niveaux plus graves : `log` → error, warn, log.
 */
export const LOG_LEVELS = ['error', 'warn', 'log', 'info', 'debug', 'verbose'] as const;
export type ConfiguredLogLevel = (typeof LOG_LEVELS)[number];

/** Du plus grave au plus bavard. `fatal` (Nest) est traité comme une erreur. */
const SEVERITY: Record<string, number> = {
  fatal: 0,
  error: 0,
  warn: 1,
  log: 2,
  info: 2,
  debug: 3,
  verbose: 4,
};

/**
 * Seuil effectif : LOG_LEVEL s'il est valide, sinon `log` en production (jamais de
 * debug/verbose non demandés) et `debug` en développement.
 */
export function resolveLogThreshold(value: string | undefined, isProduction: boolean): number {
  const normalized = value?.trim().toLowerCase();
  if (normalized && normalized in SEVERITY) {
    return SEVERITY[normalized] as number;
  }
  return isProduction ? (SEVERITY['log'] as number) : (SEVERITY['debug'] as number);
}

export function isLevelEnabled(level: string, threshold: number): boolean {
  return (SEVERITY[level] ?? 0) <= threshold;
}
