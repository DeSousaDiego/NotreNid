import {
  createApiClient,
  NetworkError,
  type ApiClient,
  type LoginInput,
  type RegisterInput,
} from '@notre-nid/api-client';
import type { PublicUser } from '@notre-nid/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { API_BASE_URL } from '../lib/config';
import { clearLastHouseholdId } from '../lib/lastHouseholdStorage';
import { secureTokenStorage } from '../lib/secureTokenStorage';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'restore-error';

interface AuthContextValue {
  status: AuthStatus;
  user: PublicUser | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  retryRestore: () => void;
}

const ApiClientContext = createContext<ApiClient | null>(null);
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<PublicUser | null>(null);

  const [apiClient] = useState(() =>
    createApiClient({
      baseUrl: API_BASE_URL,
      tokenStorage: secureTokenStorage,
      onSessionExpired: () => {
        setUser(null);
        setStatus('unauthenticated');
      },
    }),
  );

  const restore = useCallback(async () => {
    const tokens = await secureTokenStorage.getTokens();
    if (!tokens) {
      setStatus('unauthenticated');
      return;
    }
    try {
      const me = await apiClient.auth.me();
      setUser(me);
      setStatus('authenticated');
    } catch (error) {
      if (error instanceof NetworkError) {
        setStatus('restore-error');
      } else {
        setStatus('unauthenticated');
      }
    }
  }, [apiClient]);

  useEffect(() => {
    void restore();
  }, [restore]);

  const retryRestore = useCallback(() => {
    setStatus('loading');
    void restore();
  }, [restore]);

  const login = useCallback(
    async (input: LoginInput) => {
      const result = await apiClient.auth.login(input);
      await secureTokenStorage.setTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      setUser(result.user);
      setStatus('authenticated');
    },
    [apiClient],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const result = await apiClient.auth.register(input);
      await secureTokenStorage.setTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      setUser(result.user);
      setStatus('authenticated');
    },
    [apiClient],
  );

  const logout = useCallback(async () => {
    const tokens = await secureTokenStorage.getTokens();
    if (tokens) {
      await apiClient.auth.logout(tokens.refreshToken).catch(() => {
        /* déconnexion locale malgré tout si l'appel réseau échoue */
      });
    }
    await secureTokenStorage.clearTokens();
    await clearLastHouseholdId();
    setUser(null);
    setStatus('unauthenticated');
  }, [apiClient]);

  const authValue = useMemo<AuthContextValue>(
    () => ({ status, user, login, register, logout, retryRestore }),
    [status, user, login, register, logout, retryRestore],
  );

  return (
    <ApiClientContext.Provider value={apiClient}>
      <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
    </ApiClientContext.Provider>
  );
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext);
  if (!client) throw new Error('useApiClient doit être utilisé à l’intérieur de <AuthProvider>.');
  return client;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé à l’intérieur de <AuthProvider>.');
  return ctx;
}
