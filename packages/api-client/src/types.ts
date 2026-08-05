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
}
