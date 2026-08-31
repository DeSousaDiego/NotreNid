/**
 * Types et constantes partagés entre l'API et l'application mobile.
 * Miroir exact des formes de réponse réelles de l'API (voir chaque fichier
 * de `types/` pour la référence au service source).
 */

export const APP_NAME = 'Notre Nid' as const;

export * from './countries';
export * from './types/api-error';
export * from './types/auth';
export * from './types/category';
export * from './types/export';
export * from './types/household';
export * from './types/invitation';
export * from './types/item';
export * from './types/pagination';
export * from './types/stats';
export * from './types/user';
