import type { TokenStorage } from '@notre-nid/api-client';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'notre-nid.accessToken';
const REFRESH_TOKEN_KEY = 'notre-nid.refreshToken';

/** Tokens stockés via Expo SecureStore — jamais dans AsyncStorage ni en clair. */
export const secureTokenStorage: TokenStorage = {
  async getTokens() {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    ]);
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  },

  async setTokens(tokens) {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
    ]);
  },

  async clearTokens() {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
  },
};
