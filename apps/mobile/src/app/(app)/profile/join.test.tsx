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
const mockSelectHousehold = jest.fn();

jest.mock('../../../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
}));

jest.mock('../../../providers/HouseholdProvider', () => ({
  useHousehold: () => ({ selectHousehold: mockSelectHousehold }),
}));

const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
  },
}));

function createMockApiClient() {
  return {
    invitations: { accept: jest.fn() },
  } as unknown as import('@notre-nid/api-client').ApiClient;
}

function renderScreen(ui: ReactElement) {
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

    await fireEvent.press(view.getByRole('button', { name: 'Rejoindre' }));

    await waitFor(() => expect(view.getByText("Le code d'invitation est requis.")).toBeTruthy());
    expect(mockApiClient.invitations.accept).not.toHaveBeenCalled();
  });

  // Un seul rendu couvrant à la fois le rejet et le succès (plutôt que deux tests distincts
  // avec chacun leur propre `render()`) : un troisième rendu complet de cet écran dans ce
  // même fichier se corrompt de façon reproductible (l'élément recherché juste après le
  // rendu est introuvable dès la première requête, y compris pour un `render()` par ailleurs
  // strictement identique à celui des deux tests précédents) — reproduit indépendamment du
  // contenu du test, de l'ordre, et de purges de timers ajoutées entre les tests ; il s'agit
  // vraisemblablement d'une limite de cet environnement react-test-renderer/React 19 plutôt
  // que d'un bug de l'écran lui-même (chaque scénario, isolé dans son propre fichier, passe
  // sans problème). Regrouper les scénarios restants dans le second rendu contourne le souci
  // sans rien perdre en couverture.
  it('shows a human error on rejection, then normalizes the code and joins successfully on retry', async () => {
    (mockApiClient.invitations.accept as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const view = await renderScreen(<JoinHouseholdScreen />);

    fireEvent.changeText(view.getByLabelText("Code d'invitation"), 'ZZZZZZZZ');
    await fireEvent.press(view.getByRole('button', { name: 'Rejoindre' }));

    await waitFor(() =>
      expect(view.getByText("Une erreur inattendue s'est produite.")).toBeTruthy(),
    );
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockSelectHousehold).not.toHaveBeenCalled();

    (mockApiClient.invitations.accept as jest.Mock).mockResolvedValueOnce({
      householdId: 'household-2',
      householdName: 'Chez Sam',
      role: 'MEMBER',
    });

    fireEvent.changeText(view.getByLabelText("Code d'invitation"), 'nid-7k4p-2q9d');
    await fireEvent.press(view.getByRole('button', { name: 'Rejoindre' }));

    await waitFor(() => expect(mockApiClient.invitations.accept).toHaveBeenCalledWith('7K4P2Q9D'));
    await waitFor(() => expect(mockSelectHousehold).toHaveBeenCalledWith('household-2'));
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/(app)'));
    await waitFor(() => expect(view.getByText('Bienvenue dans Chez Sam 🌿')).toBeTruthy());
  });
});
