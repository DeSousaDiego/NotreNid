/**
 * Nombre de proxys de confiance devant l'API (Express `trust proxy`, valeur numérique).
 *
 * Pourquoi c'est important : le rate limiting (ThrottlerGuard) identifie le client par
 * `req.ip`. Sans `trust proxy`, derrière Render, `req.ip` est l'adresse du proxy : tous les
 * utilisateurs partagent alors le même compteur (10 connexions/min pour TOUTE l'app).
 *
 * Pourquoi un NOMBRE et jamais `true` : Render AJOUTE son entrée à `X-Forwarded-For` sans
 * nettoyer ce qu'envoie le client. Avec `true`, Express prendrait l'entrée la plus à gauche —
 * choisie librement par le client, qui pourrait changer d'« IP » à chaque requête et
 * contourner toute limite. Avec N, Express ne remonte que N entrées depuis la droite,
 * c'est-à-dire uniquement celles ajoutées par nos propres proxys.
 *
 * Valeur : 0 (désactivé) hors production ; 1 par défaut en production (au moins un proxy
 * Render, jamais de confiance excessive). Le nombre exact de sauts chez Render n'est pas
 * documenté : il se vérifie avec LOG_LEVEL=debug (voir docs/OPERATIONS.md) et s'ajuste via
 * TRUST_PROXY_HOPS sans redéploiement de code. Sous-estimer est sûr (limites plus
 * partagées) ; surestimer rouvrirait l'usurpation d'IP.
 */
export const MAX_TRUST_PROXY_HOPS = 5;

export function resolveTrustProxyHops(
  value: string | number | undefined,
  appEnv: string | undefined,
): number {
  if (value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return appEnv === 'production' ? 1 : 0;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_TRUST_PROXY_HOPS) {
    throw new Error(`TRUST_PROXY_HOPS doit être un entier entre 0 et ${MAX_TRUST_PROXY_HOPS}.`);
  }
  return parsed;
}

/** Applique la valeur à une application Express (ou NestExpressApplication). */
export function applyTrustProxy(
  app: { set(setting: string, value: unknown): unknown },
  hops: number,
): void {
  app.set('trust proxy', hops > 0 ? hops : false);
}
