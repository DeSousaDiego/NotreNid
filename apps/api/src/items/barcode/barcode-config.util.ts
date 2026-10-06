/**
 * Durée (ms) lue depuis la configuration. Une variable définie mais vide (ex.
 * `DIGITEYES_TIMEOUT_BUDGET_MS=` sur l'hébergeur) donnerait `Number('') === 0`,
 * donc un timeout immédiat sur chaque requête : toute valeur absente, non
 * numérique ou non strictement positive retombe sur `fallback`.
 */
export function positiveMsOrDefault(value: string | number | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
