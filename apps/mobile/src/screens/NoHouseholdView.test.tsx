import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ToastProvider } from '../components';
import { ThemeProvider } from '../theme';

import { NoHouseholdView } from './NoHouseholdView';

// expo-image's module-level analytics-integration probing isn't compatible
// with this jest environment (unrelated to what this test exercises) — stub
// it with a no-op component.
jest.mock('expo-image', () => ({ Image: () => null }));

const mockApiClient = createMockApiClient();
const mockLogout = jest.fn();
const mockSelectHousehold = jest.fn();

jest.mock('../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
  useAuth: () => ({ logout: mockLogout }),
}));

jest.mock('../providers/HouseholdProvider', () => ({
  useHousehold: () => ({ selectHousehold: mockSelectHousehold }),
}));

function createMockApiClient() {
  return {
    households: { create: jest.fn() },
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

describe('NoHouseholdView', () => {
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

  // Un seul rendu couvrant la création de foyer puis la déconnexion (plutôt que deux tests
  // distincts avec chacun leur `render()`) : un troisième rendu complet de cet écran dans ce
  // même fichier se corrompt de façon reproductible, indépendamment de son contenu (voir la
  // note équivalente dans profile/join.test.tsx) — vraisemblablement une limite de cet
  // environnement react-test-renderer/React 19 plutôt qu'un bug de l'écran lui-même.
  it('creates a household from the name field, then logs out', async () => {
    (mockApiClient.households.create as jest.Mock).mockResolvedValue({
      id: 'h1',
      name: 'Notre nid',
      role: 'OWNER',
    });
    const view = await renderScreen(<NoHouseholdView />);

    await fireEvent.changeText(view.getByLabelText('Nom du foyer'), 'Notre nid');
    await fireEvent.press(view.getByRole('button', { name: 'Créer mon nid' }));

    await waitFor(() => expect(mockApiClient.households.create).toHaveBeenCalledWith('Notre nid'));

    await fireEvent.press(view.getByRole('button', { name: 'Se déconnecter' }));

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  // Même regroupement que ci-dessus, pour la même raison : le rejet puis le succès du
  // parcours "rejoindre" dans un seul rendu.
  it('shows a human error on a rejected code, then joins successfully and selects the household', async () => {
    (mockApiClient.invitations.accept as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const view = await renderScreen(<NoHouseholdView />);

    fireEvent.changeText(view.getByLabelText("Code d'invitation"), 'ZZZZZZZZ');
    await fireEvent.press(view.getByRole('button', { name: 'Rejoindre' }));

    await waitFor(() =>
      expect(view.getByText("Une erreur inattendue s'est produite.")).toBeTruthy(),
    );
    expect(mockSelectHousehold).not.toHaveBeenCalled();

    (mockApiClient.invitations.accept as jest.Mock).mockResolvedValueOnce({
      householdId: 'household-1',
      householdName: 'Le Nid',
      role: 'MEMBER',
    });

    fireEvent.changeText(view.getByLabelText("Code d'invitation"), 'nid-7k4p-2q9d');
    await fireEvent.press(view.getByRole('button', { name: 'Rejoindre' }));

    await waitFor(() => expect(mockApiClient.invitations.accept).toHaveBeenCalledWith('7K4P2Q9D'));
    await waitFor(() => expect(mockSelectHousehold).toHaveBeenCalledWith('household-1'));
    await waitFor(() => expect(view.getByText('Bienvenue dans Le Nid 🌿')).toBeTruthy());
  });
});
