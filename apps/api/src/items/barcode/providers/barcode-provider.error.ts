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
  ) {
    super(message, { cause });
    this.name = 'BarcodeProviderError';
  }
}
