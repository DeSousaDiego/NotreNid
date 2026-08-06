import { NetworkError, type ApiClient } from '@notre-nid/api-client';
import type { PublicUser } from '@notre-nid/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { AuthProvider, useAuth } from './AuthProvider';

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

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
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
});
