/**
 * Nature d'un échec provider — INTERNE uniquement (logs, diagnostic), jamais
 * exposée telle quelle au mobile : le contrat public reste `status:
 * 'provider_error'` (voir docs/DECISIONS.md). Permet de distinguer dans les
 * logs Render un quota épuisé d'une clé invalide ou d'une panne, au lieu d'un
 * "service indisponible" indifférencié.
 * - `auth` : identifiants absents/invalides (configuration à corriger) ;
 * - `quota` : quota/solde épuisé (ex. UPCitemdb `EXCEED_LIMIT`, Digit-Eyes 402) ;
 * - `rate_limit` : rafale trop rapide (ex. UPCitemdb `TOO_FAST`) ;
 * - `timeout` : budget de temps épuisé ;
 * - `unavailable` : 5xx, réseau, réponse inattendue — valeur par défaut ;
 * - `invalid_response` : corps illisible ou requête refusée comme malformée.
 */
export type BarcodeProviderErrorKind =
  'auth' | 'quota' | 'rate_limit' | 'timeout' | 'unavailable' | 'invalid_response';

/**
 * Encapsule tout échec d'un provider externe (réseau, timeout, statut HTTP
 * inattendu, corps de réponse illisible) — jamais laissée fuiter jusqu'au
 * contrôleur telle quelle : le resolver l'attrape systématiquement pour soit
 * basculer sur le provider suivant, soit renvoyer `status: 'provider_error'`
 * si toute la chaîne échoue. Ne porte jamais le corps de réponse brut du
 * provider (voir `cause` pour la valeur d'origine, utile en log uniquement).
 */
export class BarcodeProviderError extends Error {
  constructor(
    public readonly providerId: string,
    message: string,
    cause?: unknown,
    public readonly kind: BarcodeProviderErrorKind = 'unavailable',
  ) {
    super(message, { cause });
    this.name = 'BarcodeProviderError';
  }
}
