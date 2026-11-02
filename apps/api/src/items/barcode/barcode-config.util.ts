/**
 * Plafond de toute durée lue depuis la configuration : au-delà, une valeur (faute de
 * frappe, unité confondue) bloquerait une requête mobile bien plus longtemps que tout
 * budget réaliste — et Node ramène silencieusement à 1 ms un délai > 2^31-1.
 */
export const MAX_CONFIG_DURATION_MS = 120_000;

/**
 * Durée (ms) lue depuis la configuration. Les variables d'environnement arrivent TOUJOURS
 * sous forme de chaîne, quel que soit le `get<number>()` côté appelant : sans conversion,
 * `Date.now() + "8000"` concatène au lieu d'additionner, et chaque tentative expire
 * immédiatement (bug constaté en Release 0B sur Open Library, MusicBrainz, UPCitemdb, TMDB).
 *
 * Une variable absente, vide (ex. `X_TIMEOUT_MS=` sur l'hébergeur, qui donnerait
 * `Number('') === 0`, donc un timeout immédiat), non numérique ou non strictement positive
 * retombe sur `fallback` ; une valeur excessive est plafonnée à MAX_CONFIG_DURATION_MS.
 */
export function positiveMsOrDefault(value: string | number | undefined, fallback: number): number {
  const parsed = typeof value === 'string' ? Number(value.trim() || Number.NaN) : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, MAX_CONFIG_DURATION_MS);
}
