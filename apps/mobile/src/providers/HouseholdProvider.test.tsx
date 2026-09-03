import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { HouseholdProvider, useHousehold } from './HouseholdProvider';

let mockStatus: 'authenticated' | 'unauthenticated' = 'authenticated';
jest.mock('./AuthProvider', () => ({
  useAuth: () => ({ status: mockStatus }),
}));

let mockHouseholds: { id: string; name: string; role: string }[] = [];
jest.mock('../hooks/useHouseholds', () => ({
  useHouseholds: () => ({
    data: mockHouseholds,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('../lib/lastHouseholdStorage', () => ({
  getLastHouseholdId: jest.fn().mockResolvedValue(null),
  setLastHouseholdId: jest.fn(),
  clearLastHouseholdId: jest.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <HouseholdProvider>{children}</HouseholdProvider>;
}

describe('HouseholdProvider', () => {
  beforeEach(() => {
    mockStatus = 'authenticated';
    mockHouseholds = [];
  });

  it('ne réutilise pas la sélection manuelle du compte précédent après un logout, même si le nouveau compte a accès aux mêmes households', async () => {
    // Foyer partagé (cas réel du couple) : les deux households restent identiques
    // avant/après le changement de compte, seul `status` transite.
    mockHouseholds = [
      { id: 'h1', name: 'Foyer A', role: 'OWNER' },
      { id: 'h2', name: 'Foyer B', role: 'MEMBER' },
    ];
    const { result, rerender } = await renderHook(() => useHousehold(), { wrapper });

    await act(async () => {
      result.current.selectHousehold('h2');
    });
    expect(result.current.householdId).toBe('h2');

    mockStatus = 'unauthenticated';
    await act(async () => {
      rerender({});
    });

    mockStatus = 'authenticated';
    await act(async () => {
      rerender({});
    });

    // Sans reset, `manualSelection` vaudrait toujours 'h2' et la nouvelle session
    // hériterait silencieusement du choix de la précédente au lieu de repasser
    // par l'écran de sélection.
    expect(result.current.householdId).toBeNull();
  });

  it('householdId retombe à null dès que le statut passe à unauthenticated', async () => {
    mockHouseholds = [{ id: 'h1', name: 'Foyer A', role: 'OWNER' }];
    const { result, rerender } = await renderHook(() => useHousehold(), { wrapper });

    expect(result.current.householdId).toBe('h1');

    mockStatus = 'unauthenticated';
    mockHouseholds = [];
    await act(async () => {
      rerender({});
    });

    expect(result.current.householdId).toBeNull();
  });
});
