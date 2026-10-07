import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ToastProvider } from '../../../components';
import { ThemeProvider } from '../../../theme';

import JoinHouseholdScreen from './join';

// expo-image's module-level analytics-integration probing isn't compatible with
// this jest environment; the components barrel pulls it in via ItemCard even
// though this screen never renders one (see docs/PHASE_STATUS.md Phase 3B).
jest.mock('expo-image', () => ({ Image: () => null }));

const mockApiClient = createMockApiClient();

jest.mock('../../../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

// Foyer courant observable, comme le vrai `HouseholdProvider` : `selectHousehold` ne
// prend effet qu'au rendu suivant, ce que l'écran doit attendre avant de naviguer.
let mockHouseholdId = 'household-1';
const mockHouseholdListeners = new Set<() => void>();
function mockSubscribeHousehold(listener: () => void) {
  mockHouseholdListeners.add(listener);
  return () => mockHouseholdListeners.delete(listener);
}
const mockSelectHousehold = jest.fn((id: string) => {
  mockHouseholdId = id;
  mockHouseholdListeners.forEach((listener) => listener());
});

jest.mock('../../../providers/HouseholdProvider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useHousehold: () => ({
      householdId: React.useSyncExternalStore(mockSubscribeHousehold, () => mockHouseholdId),
      households: [{ id: 'household-1', name: 'Le Nid', role: 'OWNER' }],
      selectHousehold: mockSelectHousehold,
    }),
  };
});

const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
  },
}));

function createMockApiClient() {
  return {
    invitations: { accept: jest.fn() },
    households: { list: jest.fn() },
  } as unknown as import('@notre-nid/api-client').ApiClient;
}

const LE_NID = { id: 'household-1', name: 'Le Nid', role: 'OWNER' };
const CHEZ_SAM = { id: 'household-2', name: 'Chez Sam', role: 'MEMBER' };

const accept = () => mockApiClient.invitations.accept as jest.Mock;
const listHouseholds = () => mockApiClient.households.list as jest.Mock;

async function renderScreen(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider fontsLoaded={false}>
        <ToastProvider>{ui}</ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('JoinHouseholdScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHouseholdId = 'household-1';
  });

  // `ToastProvider` schedules a real 3s hide timeout per `showToast()` call (see
  // src/components/Toast.tsx). Left pending past the end of this file, it fires after Jest
  // tears down the `react-native` module registry and crashes the worker (`Animated`
  // resolves to undefined at that point). Draining it here keeps it inside a live environment.
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3200));
  });

  it('requires a code before calling the API', async () => {
    const view = await renderScreen(<JoinHouseholdScreen />);

    // Changer de foyer n'est ni anodin ni alarmant : le foyer actuel reste accessible.
    expect(
      view.getByText(/« Le Nid » reste accessible à tout moment depuis votre profil/),
    ).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Rejoindre ce foyer' }));

    await waitFor(() => expect(view.getByText("Le code d'invitation est requis.")).toBeTruthy());
    expect(accept()).not.toHaveBeenCalled();
  });

  // Tous les `fireEvent` sont attendus, `changeText` compris : dans cette version de RNTL ils
  // retournent une promesse enveloppée dans `act()`. Un `changeText` non attendu suivi d'un
  // `press` produisait des `act()` qui se chevauchent ; l'environnement `act` restait alors
  // cassé pour la suite du fichier (« troisième rendu corrompu », élément introuvable juste
  // après `render`), cause réelle de l'instabilité autrefois attribuée à l'environnement.
  it('shows a human error on rejection, then refreshes the list before selecting the joined household and going home', async () => {
    accept().mockRejectedValueOnce(new Error('boom'));
    const view = await renderScreen(<JoinHouseholdScreen />);

    await fireEvent.changeText(view.getByLabelText("Code d'invitation"), 'ZZZZZZZZ');
    await fireEvent.press(view.getByRole('button', { name: 'Rejoindre ce foyer' }));

    await waitFor(() =>
      expect(view.getByText("Une erreur inattendue s'est produite.")).toBeTruthy(),
    );
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockSelectHousehold).not.toHaveBeenCalled();
    expect(listHouseholds()).not.toHaveBeenCalled();

    accept().mockResolvedValueOnce({
      householdId: 'household-2',
      householdName: 'Chez Sam',
      role: 'MEMBER',
    });
    listHouseholds().mockResolvedValue([LE_NID, CHEZ_SAM]);

    await fireEvent.changeText(view.getByLabelText("Code d'invitation"), 'nid-7k4p-2q9d');
    await fireEvent.press(view.getByRole('button', { name: 'Rejoindre ce foyer' }));

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/'));
    expect(accept()).toHaveBeenCalledWith('7K4P2Q9D');
    expect(mockSelectHousehold).toHaveBeenCalledWith('household-2');
    // Liste rechargée → sélection → navigation, dans cet ordre.
    const listOrder = listHouseholds().mock.invocationCallOrder[0] as number;
    const selectOrder = mockSelectHousehold.mock.invocationCallOrder[0] as number;
    expect(accept().mock.invocationCallOrder[1]).toBeLessThan(listOrder);
    expect(listOrder).toBeLessThan(selectOrder);
    expect(selectOrder).toBeLessThan(mockRouterReplace.mock.invocationCallOrder[0] as number);
    await waitFor(() => expect(view.getByText('Bienvenue dans Chez Sam 🌿')).toBeTruthy());
  });

  it('never announces success nor navigates when the list cannot be refreshed, and lets the user retry', async () => {
    accept().mockResolvedValue({
      householdId: 'household-2',
      householdName: 'Chez Sam',
      role: 'MEMBER',
    });
    listHouseholds().mockRejectedValueOnce(new Error('offline'));
    const view = await renderScreen(<JoinHouseholdScreen />);

    await fireEvent.changeText(view.getByLabelText("Code d'invitation"), '7K4P2Q9D');
    await fireEvent.press(view.getByRole('button', { name: 'Rejoindre ce foyer' }));

    await waitFor(() => expect(view.getByText('Encore un instant')).toBeTruthy());
    expect(view.getByText(/Vous avez bien rejoint « Chez Sam »/)).toBeTruthy();
    expect(mockSelectHousehold).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(view.queryByText('Bienvenue dans Chez Sam 🌿')).toBeNull();

    listHouseholds().mockResolvedValueOnce([LE_NID, CHEZ_SAM]);
    await fireEvent.press(view.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/'));
    expect(mockSelectHousehold).toHaveBeenCalledWith('household-2');
    // Le code, déjà consommé, n'est jamais renvoyé une seconde fois.
    expect(accept()).toHaveBeenCalledTimes(1);
  });
});
