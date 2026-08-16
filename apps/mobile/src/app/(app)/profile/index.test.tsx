import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ToastProvider } from '../../../components';
import { ThemeProvider } from '../../../theme';

import ProfileScreen from './index';

// expo-image's module-level analytics-integration probing isn't compatible with
// this jest environment; the components barrel pulls it in via ItemCard even
// though this screen never renders one (see docs/PHASE_STATUS.md Phase 3B).
jest.mock('expo-image', () => ({ Image: () => null }));

const mockApiClient = createMockApiClient();
const mockUser = {
  id: 'user-1',
  email: 'alix@example.com',
  displayName: 'Alix',
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const mockLogout = jest.fn();
const mockLogoutAllDevices = jest.fn();

jest.mock('../../../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
  useAuth: () => ({ user: mockUser, logout: mockLogout, logoutAllDevices: mockLogoutAllDevices }),
}));

const mockClearSelection = jest.fn();
let mockHouseholds: {
  id: string;
  name: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}[] = [];

jest.mock('../../../providers/HouseholdProvider', () => ({
  useHousehold: () => ({
    householdId: 'household-1',
    households: mockHouseholds,
    isLoading: false,
    isError: false,
    selectHousehold: jest.fn(),
    clearSelection: mockClearSelection,
    refetch: jest.fn(),
  }),
}));

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
}));

const mockShareExportFile = jest.fn();
jest.mock('../../../lib/exportFile', () => ({
  shareExportFile: (...args: unknown[]) => mockShareExportFile(...args),
}));

function createMockApiClient() {
  return {
    households: { list: jest.fn() },
    exports: { json: jest.fn(), csv: jest.fn() },
  } as unknown as import('@notre-nid/api-client').ApiClient;
}

const LE_NID = {
  id: 'household-1',
  name: 'Le Nid',
  createdById: 'user-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  role: 'OWNER' as const,
};

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

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHouseholds = [LE_NID];
    (mockApiClient.households.list as jest.Mock).mockResolvedValue([LE_NID]);
  });

  it('renders the current user and household', async () => {
    const view = await renderScreen(<ProfileScreen />);

    expect(view.getByText('Alix')).toBeTruthy();
    expect(view.getByText('alix@example.com')).toBeTruthy();
    await waitFor(() => expect(view.getByText('Le Nid')).toBeTruthy());
  });

  it('navigates to each management screen', async () => {
    const view = await renderScreen(<ProfileScreen />);
    await waitFor(() => expect(view.getByText('Le Nid')).toBeTruthy());

    await fireEvent.press(view.getByRole('button', { name: 'Membres' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/profile/members');

    await fireEvent.press(view.getByRole('button', { name: 'Invitations' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/profile/invitations');

    await fireEvent.press(view.getByRole('button', { name: 'Catégories' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/profile/categories');

    await fireEvent.press(view.getByRole('button', { name: 'Archives' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/profile/archives');

    await fireEvent.press(view.getByRole('button', { name: 'Rejoindre un foyer' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/profile/join');
  });

  it('only offers to switch households when the user belongs to more than one', async () => {
    mockHouseholds = [LE_NID];
    const single = await renderScreen(<ProfileScreen />);
    await waitFor(() => expect(single.getByText('Le Nid')).toBeTruthy());
    expect(single.queryByText('Changer de foyer')).toBeNull();

    mockHouseholds = [LE_NID, { ...LE_NID, id: 'household-2', name: 'Le Chalet' }];
    const view = await renderScreen(<ProfileScreen />);
    await waitFor(() => expect(view.getByText('Changer de foyer')).toBeTruthy());

    await fireEvent.press(view.getByText('Changer de foyer'));
    expect(mockClearSelection).toHaveBeenCalledTimes(1);
  });

  it('exports the collection as JSON and CSV', async () => {
    (mockApiClient.exports.json as jest.Mock).mockResolvedValue([{ id: 'item-1' }]);
    (mockApiClient.exports.csv as jest.Mock).mockResolvedValue('id\nitem-1\n');
    const view = await renderScreen(<ProfileScreen />);
    await waitFor(() => expect(view.getByText('Le Nid')).toBeTruthy());

    await fireEvent.press(view.getByRole('button', { name: 'Exporter en JSON' }));
    await waitFor(() => expect(mockApiClient.exports.json).toHaveBeenCalledWith('household-1'));
    await waitFor(() =>
      expect(mockShareExportFile).toHaveBeenCalledWith(
        'Le Nid',
        'json',
        JSON.stringify([{ id: 'item-1' }], null, 2),
      ),
    );

    await fireEvent.press(view.getByRole('button', { name: 'Exporter en CSV' }));
    await waitFor(() => expect(mockApiClient.exports.csv).toHaveBeenCalledWith('household-1'));
    await waitFor(() =>
      expect(mockShareExportFile).toHaveBeenCalledWith('Le Nid', 'csv', 'id\nitem-1\n'),
    );
  });

  it('logs out and logs out of all devices', async () => {
    const view = await renderScreen(<ProfileScreen />);
    await waitFor(() => expect(view.getByText('Le Nid')).toBeTruthy());

    await fireEvent.press(view.getByRole('button', { name: 'Se déconnecter' }));
    expect(mockLogout).toHaveBeenCalledTimes(1);

    await fireEvent.press(
      view.getByRole('button', { name: 'Se déconnecter de tous les appareils' }),
    );
    expect(mockLogoutAllDevices).toHaveBeenCalledTimes(1);
  });

  it('shows an error message when the households list fails to load', async () => {
    (mockApiClient.households.list as jest.Mock).mockRejectedValue(new Error('boom'));
    const view = await renderScreen(<ProfileScreen />);

    await waitFor(() => expect(view.getByText('Impossible de charger vos foyers.')).toBeTruthy());
  });
});
