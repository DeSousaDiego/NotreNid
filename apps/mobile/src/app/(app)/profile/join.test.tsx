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
}));

const mockRouterBack = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    back: (...args: unknown[]) => mockRouterBack(...args),
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

  it('requires a token before calling the API', async () => {
    const view = await renderScreen(<JoinHouseholdScreen />);

    await fireEvent.press(view.getByRole('button', { name: 'Rejoindre' }));

    await waitFor(() => expect(view.getByText('Le jeton d’invitation est requis.')).toBeTruthy());
    expect(mockApiClient.invitations.accept).not.toHaveBeenCalled();
  });

  it('accepts the invitation with the trimmed token and navigates back', async () => {
    (mockApiClient.invitations.accept as jest.Mock).mockResolvedValue({});
    const view = await renderScreen(<JoinHouseholdScreen />);

    await fireEvent.changeText(view.getByLabelText("Jeton d'invitation"), '  raw-token  ');
    await fireEvent.press(view.getByRole('button', { name: 'Rejoindre' }));

    await waitFor(() => expect(mockApiClient.invitations.accept).toHaveBeenCalledWith('raw-token'));
    await waitFor(() => expect(mockRouterBack).toHaveBeenCalledTimes(1));
  });

  it('shows an error toast and stays on the screen when the token is rejected', async () => {
    (mockApiClient.invitations.accept as jest.Mock).mockRejectedValue(new Error('boom'));
    const view = await renderScreen(<JoinHouseholdScreen />);

    await fireEvent.changeText(view.getByLabelText("Jeton d'invitation"), 'bad-token');
    await fireEvent.press(view.getByRole('button', { name: 'Rejoindre' }));

    await waitFor(() =>
      expect(view.getByText("Une erreur inattendue s'est produite.")).toBeTruthy(),
    );
    expect(mockRouterBack).not.toHaveBeenCalled();
  });
});
