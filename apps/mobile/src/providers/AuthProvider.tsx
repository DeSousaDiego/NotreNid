import {
  createApiClient,
  NetworkError,
  type ApiClient,
  type LoginInput,
  type RegisterInput,
} from '@notre-nid/api-client';
import type { PublicUser } from '@notre-nid/shared';
import { useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

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
  logoutAllDevices: () => Promise<void>;
  retryRestore: () => void;
  /**
   * Met à jour l'utilisateur courant en cache après une modification de profil
   * réussie (Bloc 4). Une fois `login`/`register` appelés, `user` est figé sur
   * l'instantané reçu à ce moment-là — `restoreQuery` reste désactivée pour le
   * reste de la session (`enabled: override === null`) — donc un simple
   * `refetch()` de la query ne suffirait pas à faire apparaître un nom/une photo
   * modifiés. Passer directement l'utilisateur déjà retourné par la mutation
   * (`updateProfile`/`uploadAvatar`/`removeAvatar`) pour éviter un aller-retour
   * réseau superflu ; sans argument, revalide via `GET /auth/me`.
   */
  refreshUser: (freshUser?: PublicUser) => Promise<void>;
}

/**
 * Une fois qu'une action explicite (connexion, inscription, déconnexion,
 * expiration de session) s'est produite, elle prévaut définitivement sur le
 * résultat de la requête de restauration de session — celle-ci n'est utile
 * qu'au tout premier rendu, avant toute interaction.
 */
type AuthOverride =
  { kind: 'authenticated'; user: PublicUser } | { kind: 'unauthenticated' } | null;

const ApiClientContext = createContext<ApiClient | null>(null);
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<AuthOverride>(null);

  const [apiClient] = useState(() =>
    createApiClient({
      baseUrl: API_BASE_URL,
      tokenStorage: secureTokenStorage,
      onSessionExpired: () => {
        setOverride({ kind: 'unauthenticated' });
      },
    }),
  );

  const restoreQuery = useQuery({
    queryKey: ['auth', 'restore'],
    queryFn: async (): Promise<PublicUser | null> => {
      const tokens = await secureTokenStorage.getTokens();
      if (!tokens) return null;
      return apiClient.auth.me();
    },
    enabled: override === null,
    retry: false,
    staleTime: Infinity,
  });

  const status: AuthStatus = useMemo(() => {
    if (override?.kind === 'authenticated') return 'authenticated';
    if (override?.kind === 'unauthenticated') return 'unauthenticated';
    if (restoreQuery.isError) {
      return restoreQuery.error instanceof NetworkError ? 'restore-error' : 'unauthenticated';
    }
    if (restoreQuery.isSuccess) {
      return restoreQuery.data ? 'authenticated' : 'unauthenticated';
    }
    return 'loading';
  }, [
    override,
    restoreQuery.isError,
    restoreQuery.error,
    restoreQuery.isSuccess,
    restoreQuery.data,
  ]);

  const user: PublicUser | null = useMemo(() => {
    if (override?.kind === 'authenticated') return override.user;
    if (override?.kind === 'unauthenticated') return null;
    return restoreQuery.data ?? null;
  }, [override, restoreQuery.data]);

  const retryRestore = useCallback(() => {
    void restoreQuery.refetch();
  }, [restoreQuery]);

  const login = useCallback(
    async (input: LoginInput) => {
      const result = await apiClient.auth.login(input);
      await secureTokenStorage.setTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      setOverride({ kind: 'authenticated', user: result.user });
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
      setOverride({ kind: 'authenticated', user: result.user });
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
    setOverride({ kind: 'unauthenticated' });
  }, [apiClient]);

  const logoutAllDevices = useCallback(async () => {
    await apiClient.auth.logoutAll().catch(() => {
      /* déconnexion locale malgré tout si l'appel réseau échoue */
    });
    await secureTokenStorage.clearTokens();
    await clearLastHouseholdId();
    setOverride({ kind: 'unauthenticated' });
  }, [apiClient]);

  const refreshUser = useCallback(
    async (freshUser?: PublicUser) => {
      const nextUser = freshUser ?? (await apiClient.auth.me());
      setOverride({ kind: 'authenticated', user: nextUser });
    },
    [apiClient],
  );

  const authValue = useMemo<AuthContextValue>(
    () => ({ status, user, login, register, logout, logoutAllDevices, retryRestore, refreshUser }),
    [status, user, login, register, logout, logoutAllDevices, retryRestore, refreshUser],
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
