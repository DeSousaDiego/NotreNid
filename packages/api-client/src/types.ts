export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Abstraction du stockage sécurisé des tokens. L'implémentation réelle
 * (Expo SecureStore) vit côté application mobile : ce package reste pur
 * TypeScript, sans dépendance Expo/React Native.
 */
export interface TokenStorage {
  getTokens(): Promise<StoredTokens | null>;
  setTokens(tokens: StoredTokens): Promise<void>;
  clearTokens(): Promise<void>;
}

export interface ApiClientConfig {
  /** Ex. "http://192.168.1.31:3000/api/v1" (voir MOBILE_PUBLIC_API_URL). */
  baseUrl: string;
  tokenStorage: TokenStorage;
  /** Appelé quand le refresh token est définitivement invalide (session expirée). */
  onSessionExpired?: () => void;
  /**
   * Identifiant de la "génération" de session en cours, incrémenté par
   * l'appelant à chaque login/register/logout. Un rafraîchissement automatique
   * relit cette valeur juste avant d'écrire ses nouveaux tokens : si elle a
   * changé depuis le début du rafraîchissement, la session qui l'a déclenché
   * n'est plus la session active (l'utilisateur s'est déconnecté/reconnecté
   * pendant l'appel réseau) et l'écriture est abandonnée — défense en
   * profondeur contre un rafraîchissement résiduel qui écraserait les tokens
   * d'une session plus récente.
   */
  getSessionGeneration?: () => number;
}
