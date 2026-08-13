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

jest.mock('../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
  useAuth: () => ({ logout: mockLogout }),
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

  it('creates a household from the name field', async () => {
    (mockApiClient.households.create as jest.Mock).mockResolvedValue({
      id: 'h1',
      name: 'Notre nid',
      role: 'OWNER',
    });
    const view = await renderScreen(<NoHouseholdView />);

    await fireEvent.changeText(view.getByLabelText('Nom du foyer'), 'Notre nid');
    await fireEvent.press(view.getByRole('button', { name: 'Créer mon nid' }));

    await waitFor(() => expect(mockApiClient.households.create).toHaveBeenCalledWith('Notre nid'));
  });

  it('joins a household via an invitation token', async () => {
    (mockApiClient.invitations.accept as jest.Mock).mockResolvedValue({});
    const view = await renderScreen(<NoHouseholdView />);

    await fireEvent.changeText(view.getByLabelText("Jeton d'invitation"), 'raw-token');
    await fireEvent.press(view.getByRole('button', { name: 'Rejoindre' }));

    await waitFor(() => expect(mockApiClient.invitations.accept).toHaveBeenCalledWith('raw-token'));
  });

  it('logs out', async () => {
    const view = await renderScreen(<NoHouseholdView />);

    await fireEvent.press(view.getByRole('button', { name: 'Se déconnecter' }));

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
