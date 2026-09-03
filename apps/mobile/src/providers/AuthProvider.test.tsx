import { NetworkError, type ApiClient } from '@notre-nid/api-client';
import type { PublicUser } from '@notre-nid/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { AuthProvider, useAuth } from './AuthProvider';

/**
 * Promesse contrôlable pour simuler un appel réseau lent/injoignable sans
 * jamais laisser une promesse véritablement éternelle fuiter d'un test vers
 * les suivants (source de plantages en cascade sous Jest).
 */
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

jest.mock('../lib/secureTokenStorage', () => ({
  secureTokenStorage: {
    getTokens: jest.fn(),
    setTokens: jest.fn(),
    clearTokens: jest.fn(),
  },
}));
jest.mock('../lib/lastHouseholdStorage', () => ({
  clearLastHouseholdId: jest.fn(),
}));

let onSessionExpired: () => void = () => {};

jest.mock('@notre-nid/api-client', () => {
  const actual = jest.requireActual('@notre-nid/api-client');
  return {
    ...actual,
    createApiClient: jest.fn((config: { onSessionExpired?: () => void }) => {
      onSessionExpired = config.onSessionExpired ?? (() => {});
      return mockAuthClient;
    }),
  };
});

const mockAuthClient: Pick<ApiClient, 'auth'> = {
  auth: {
    me: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    logoutAll: jest.fn(),
    refresh: jest.fn(),
  },
};

const { secureTokenStorage } = jest.requireMock('../lib/secureTokenStorage') as {
  secureTokenStorage: {
    getTokens: jest.Mock;
    setTokens: jest.Mock;
    clearTokens: jest.Mock;
  };
};

const user: PublicUser = {
  id: 'user-1',
  email: 'alix@example.com',
  displayName: 'Alix',
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const userB: PublicUser = {
  id: 'user-2',
  email: 'sam@example.com',
  displayName: 'Sam',
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

/**
 * Contrairement à `wrapper` ci-dessus (un `QueryClient` neuf à chaque re-render,
 * suffisant pour les tests qui n'inspectent pas le cache), ce helper expose un
 * `QueryClient` STABLE sur toute la durée du test — nécessaire pour vérifier
 * qu'il est bien vidé au logout, ou pour simuler un vrai relaunch d'app avec un
 * `QueryClient` intentionnellement différent (nouveau processus = nouveau cache).
 */
/**
 * `['auth', 'restore']` est une entrée technique interne à `AuthProvider`
 * (jamais de données de compte : `data` reste `undefined`/désactivée hors
 * restauration) qui se régénère du simple fait que le hook reste monté et
 * observé — normal même juste après un `queryClient.clear()`. Les garanties
 * d'isolation portent sur les entrées scopées par utilisateur (`['users', ...]`).
 */
function userScopedCacheEntries(client: QueryClient) {
  return client.getQueryCache().findAll({ queryKey: ['users'] });
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function stableWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  }
  return { queryClient, wrapper: stableWrapper };
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('restaure la session en "unauthenticated" quand aucun token n’est stocké', async () => {
    secureTokenStorage.getTokens.mockResolvedValue(null);

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(result.current.user).toBeNull();
  });

  it('restaure la session en "authenticated" quand des tokens valides sont stockés', async () => {
    secureTokenStorage.getTokens.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    (mockAuthClient.auth.me as jest.Mock).mockResolvedValue(user);

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.user).toEqual(user);
  });

  it('passe en "restore-error" quand la restauration échoue pour une raison réseau', async () => {
    secureTokenStorage.getTokens.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    (mockAuthClient.auth.me as jest.Mock).mockRejectedValue(new NetworkError());

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('restore-error'));
  });

  it('passe en "authenticated" après login()', async () => {
    secureTokenStorage.getTokens.mockResolvedValue(null);
    (mockAuthClient.auth.login as jest.Mock).mockResolvedValue({
      user,
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await act(async () => {
      await result.current.login({ email: user.email, password: 'secret123' });
    });

    expect(result.current.status).toBe('authenticated');
    expect(result.current.user).toEqual(user);
    expect(secureTokenStorage.setTokens).toHaveBeenCalledWith({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
  });

  it('revient à "unauthenticated" après logout()', async () => {
    secureTokenStorage.getTokens.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    (mockAuthClient.auth.me as jest.Mock).mockResolvedValue(user);
    (mockAuthClient.auth.logout as jest.Mock).mockResolvedValue(undefined);

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
    expect(secureTokenStorage.clearTokens).toHaveBeenCalled();
  });

  it('vide les tokens locaux et repasse "unauthenticated" même si la révocation réseau ne répond jamais', async () => {
    secureTokenStorage.getTokens.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    (mockAuthClient.auth.me as jest.Mock).mockResolvedValue(user);
    // Réseau très lent/injoignable pendant le logout. La déconnexion locale
    // (tokens, cache, statut) ne doit jamais dépendre de cet appel — sinon un
    // force-quit pendant cette attente laisse les anciens tokens intacts et
    // la session revient à la relance.
    const pendingRevoke = createDeferred<void>();
    (mockAuthClient.auth.logout as jest.Mock).mockReturnValue(pendingRevoke.promise);

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    const logoutPromise = result.current.logout();
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(result.current.user).toBeNull();
    expect(secureTokenStorage.clearTokens).toHaveBeenCalled();

    // Nettoyage : ne pas laisser cette promesse pendante fuiter vers les tests suivants.
    pendingRevoke.resolve();
    await logoutPromise;
  });

  it('revient à "unauthenticated" après logoutAllDevices()', async () => {
    secureTokenStorage.getTokens.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    (mockAuthClient.auth.me as jest.Mock).mockResolvedValue(user);
    (mockAuthClient.auth.logoutAll as jest.Mock).mockResolvedValue(undefined);

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
      await result.current.logoutAllDevices();
    });

    expect(mockAuthClient.auth.logoutAll).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
    expect(secureTokenStorage.clearTokens).toHaveBeenCalled();
  });

  it('vide les tokens locaux et repasse "unauthenticated" même si logoutAllDevices() ne répond jamais côté réseau', async () => {
    secureTokenStorage.getTokens.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    (mockAuthClient.auth.me as jest.Mock).mockResolvedValue(user);
    const pendingRevoke = createDeferred<void>();
    (mockAuthClient.auth.logoutAll as jest.Mock).mockReturnValue(pendingRevoke.promise);

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    const logoutPromise = result.current.logoutAllDevices();
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(secureTokenStorage.clearTokens).toHaveBeenCalled();

    pendingRevoke.resolve();
    await logoutPromise;
  });

  it('revient à "unauthenticated" quand la session expire (refresh token révoqué)', async () => {
    secureTokenStorage.getTokens.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    (mockAuthClient.auth.me as jest.Mock).mockResolvedValue(user);

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(() => {
      onSessionExpired();
    });

    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
  });

  it('vide entièrement le cache TanStack Query au logout : aucune donnée du compte ne doit survivre à la déconnexion', async () => {
    secureTokenStorage.getTokens.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    (mockAuthClient.auth.me as jest.Mock).mockResolvedValue(user);
    (mockAuthClient.auth.logout as jest.Mock).mockResolvedValue(undefined);

    const { queryClient, wrapper: stableWrapper } = createWrapper();
    const { result } = await renderHook(() => useAuth(), { wrapper: stableWrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    // Simule des données déjà en cache pour ce compte (households/items/stats...).
    queryClient.setQueryData(['users', user.id, 'households'], [{ id: 'h1', name: 'Notre nid' }]);
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0);

    await act(async () => {
      await result.current.logout();
    });

    expect(userScopedCacheEntries(queryClient)).toHaveLength(0);
  });

  it('vide entièrement le cache TanStack Query au logoutAllDevices()', async () => {
    secureTokenStorage.getTokens.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    (mockAuthClient.auth.me as jest.Mock).mockResolvedValue(user);
    (mockAuthClient.auth.logoutAll as jest.Mock).mockResolvedValue(undefined);

    const { queryClient, wrapper: stableWrapper } = createWrapper();
    const { result } = await renderHook(() => useAuth(), { wrapper: stableWrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    queryClient.setQueryData(['users', user.id, 'households'], [{ id: 'h1', name: 'Notre nid' }]);

    await act(async () => {
      await result.current.logoutAllDevices();
    });

    expect(userScopedCacheEntries(queryClient)).toHaveLength(0);
  });

  it.each([
    ['A puis B', user, userB],
    ['B puis A', userB, user],
  ])(
    '%s : aucune donnée ni identité du premier compte ne survit à la connexion du second',
    async (_label, first, second) => {
      secureTokenStorage.getTokens.mockResolvedValue(null);
      (mockAuthClient.auth.logout as jest.Mock).mockResolvedValue(undefined);
      (mockAuthClient.auth.login as jest.Mock).mockResolvedValueOnce({
        user: first,
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
      });

      const { queryClient, wrapper: stableWrapper } = createWrapper();
      const { result } = await renderHook(() => useAuth(), { wrapper: stableWrapper });
      await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

      await act(async () => {
        await result.current.login({ email: first.email, password: 'secret123' });
      });
      expect(result.current.user).toEqual(first);

      // Données de collection déjà chargées pour le premier compte (household partagé inclus).
      queryClient.setQueryData(
        ['users', first.id, 'households'],
        [{ id: 'h-shared', name: 'Nid' }],
      );

      await act(async () => {
        await result.current.logout();
      });
      expect(userScopedCacheEntries(queryClient)).toHaveLength(0);

      (mockAuthClient.auth.login as jest.Mock).mockResolvedValueOnce({
        user: second,
        accessToken: 'access-2',
        refreshToken: 'refresh-2',
      });
      await act(async () => {
        await result.current.login({ email: second.email, password: 'secret123' });
      });

      expect(result.current.user).toEqual(second);
      expect(result.current.user).not.toEqual(first);
      // Aucune trace du household du premier compte ne doit être lisible par le second.
      expect(queryClient.getQueryData(['users', first.id, 'households'])).toBeUndefined();
    },
  );

  it('logout puis relance de l’app : reste déconnecté, aucune restauration silencieuse', async () => {
    secureTokenStorage.getTokens.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    (mockAuthClient.auth.me as jest.Mock).mockResolvedValue(user);
    (mockAuthClient.auth.logout as jest.Mock).mockResolvedValue(undefined);

    const { result } = await renderHook(() => useAuth(), { wrapper: createWrapper().wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.status).toBe('unauthenticated');

    // Relance : nouveau processus donc nouveau QueryClient, et SecureStore
    // désormais vide (clearTokens() a été appelé pendant le logout ci-dessus).
    secureTokenStorage.getTokens.mockResolvedValue(null);
    const relaunch = await renderHook(() => useAuth(), { wrapper: createWrapper().wrapper });

    await waitFor(() => expect(relaunch.result.current.status).toBe('unauthenticated'));
    expect(relaunch.result.current.user).toBeNull();
  });

  it('login A puis relance de l’app : restaure uniquement A', async () => {
    secureTokenStorage.getTokens.mockResolvedValue(null);
    (mockAuthClient.auth.login as jest.Mock).mockResolvedValue({
      user,
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    const { result } = await renderHook(() => useAuth(), { wrapper: createWrapper().wrapper });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await act(async () => {
      await result.current.login({ email: user.email, password: 'secret123' });
    });
    expect(result.current.user).toEqual(user);

    // Relance : SecureStore contient désormais les tokens écrits par login().
    secureTokenStorage.getTokens.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    (mockAuthClient.auth.me as jest.Mock).mockResolvedValue(user);

    const relaunch = await renderHook(() => useAuth(), { wrapper: createWrapper().wrapper });

    await waitFor(() => expect(relaunch.result.current.status).toBe('authenticated'));
    expect(relaunch.result.current.user).toEqual(user);
  });

  it('un mauvais mot de passe après une session valide ne restaure jamais silencieusement l’ancien compte', async () => {
    secureTokenStorage.getTokens.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    (mockAuthClient.auth.me as jest.Mock).mockResolvedValue(user);
    (mockAuthClient.auth.logout as jest.Mock).mockResolvedValue(undefined);

    const { result } = await renderHook(() => useAuth(), { wrapper: createWrapper().wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.status).toBe('unauthenticated');

    const invalidCredentials = Object.assign(new Error('Email ou mot de passe incorrect.'), {
      code: 'INVALID_CREDENTIALS',
    });
    (mockAuthClient.auth.login as jest.Mock).mockRejectedValue(invalidCredentials);

    await act(async () => {
      await expect(
        result.current.login({ email: user.email, password: 'wrong-password' }),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
    expect(secureTokenStorage.setTokens).not.toHaveBeenCalled();
  });
});
