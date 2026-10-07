import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ToastProvider } from '../../../components';
import { ThemeProvider } from '../../../theme';

import ProfileScreen from './profile';

// expo-image's module-level analytics-integration probing isn't compatible with
// this jest environment; the components barrel pulls it in via ItemCard even
// though this screen never renders one (see docs/PHASE_STATUS.md Phase 3B).
jest.mock('expo-image', () => ({ Image: () => null }));

// `useTabBarClearance` a besoin d'un `useSafeAreaInsets` réel ; ce test ne rend pas de
// `SafeAreaProvider` — seul ce hook est mocké, le reste du module reste réel.
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

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
    households: { list: jest.fn(), listMembers: jest.fn() },
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

function member(id: string, displayName: string, role: 'OWNER' | 'ADMIN' | 'MEMBER') {
  return {
    id: `membership-${id}`,
    role,
    joinedAt: '2026-01-01T00:00:00.000Z',
    user: { ...mockUser, id, displayName, email: `${id}@example.com` },
  };
}

const TWO_MEMBERS = [member('user-1', 'Alix', 'OWNER'), member('user-2', 'Sam', 'MEMBER')];

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
    (mockApiClient.households.listMembers as jest.Mock).mockResolvedValue(TWO_MEMBERS);
  });

  it('renders the current user and household', async () => {
    const view = await renderScreen(<ProfileScreen />);

    expect(view.getByText('Alix')).toBeTruthy();
    expect(view.getByText('alix@example.com')).toBeTruthy();
    await waitFor(() => expect(view.getByText('Le Nid')).toBeTruthy());
  });

  it('shows the fallback initials when the user has no avatar photo', async () => {
    const view = await renderScreen(<ProfileScreen />);
    await waitFor(() => expect(view.getByText('Le Nid')).toBeTruthy());

    expect(view.getAllByText('A').length).toBeGreaterThan(0);
  });

  it('navigates to each management screen', async () => {
    const view = await renderScreen(<ProfileScreen />);
    await waitFor(() => expect(view.getByText('Le Nid')).toBeTruthy());

    await fireEvent.press(view.getByRole('button', { name: 'Modifier mon profil' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/profile/edit');

    await fireEvent.press(view.getByRole('button', { name: 'Membres' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/profile/members');

    await fireEvent.press(view.getByRole('button', { name: 'Invitations' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/profile/invitations');

    await fireEvent.press(view.getByRole('button', { name: 'Catégories' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/profile/categories');

    await fireEvent.press(view.getByRole('button', { name: 'Archives' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/profile/archives');

    await fireEvent.press(view.getByRole('button', { name: 'Rejoindre un autre foyer' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/profile/join');
  });

  it('hides the invitations entry from a plain member, who could only reach a dead end', async () => {
    mockHouseholds = [{ ...LE_NID, role: 'MEMBER' }];
    const view = await renderScreen(<ProfileScreen />);
    await waitFor(() => expect(view.getByText('Le Nid')).toBeTruthy());

    expect(view.queryByRole('button', { name: 'Invitations' })).toBeNull();
    expect(view.getByRole('button', { name: 'Membres' })).toBeTruthy();
  });

  it('shows the invitations entry to an admin', async () => {
    mockHouseholds = [{ ...LE_NID, role: 'ADMIN' }];
    const view = await renderScreen(<ProfileScreen />);
    await waitFor(() => expect(view.getByText('Le Nid')).toBeTruthy());

    expect(view.getByRole('button', { name: 'Invitations' })).toBeTruthy();
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

    await fireEvent.press(view.getByRole('button', { name: 'Sauvegarde complète, fichier JSON' }));
    await waitFor(() => expect(mockApiClient.exports.json).toHaveBeenCalledWith('household-1'));
    await waitFor(() =>
      expect(mockShareExportFile).toHaveBeenCalledWith(
        'Le Nid',
        'json',
        JSON.stringify([{ id: 'item-1' }], null, 2),
      ),
    );

    await fireEvent.press(view.getByRole('button', { name: 'Exporter en tableur, fichier CSV' }));
    await waitFor(() => expect(mockApiClient.exports.csv).toHaveBeenCalledWith('household-1'));
    await waitFor(() =>
      expect(mockShareExportFile).toHaveBeenCalledWith('Le Nid', 'csv', 'id\nitem-1\n'),
    );
  });

  it('logs out and logs out of all devices', async () => {
    const view = await renderScreen(<ProfileScreen />);
    await waitFor(() => expect(view.getByText('Le Nid')).toBeTruthy());

    // Un vrai bloc de session : en-tête discret, deux actions, la seconde expliquée.
    expect(view.getByRole('header', { name: 'Session' })).toBeTruthy();
    expect(view.getByText('Ferme aussi les autres sessions actives')).toBeTruthy();
    expect(
      view.getByRole('button', { name: 'Se déconnecter de tous les appareils' }).props
        .accessibilityHint,
    ).toBe('Ferme aussi les autres sessions actives');

    await fireEvent.press(view.getByRole('button', { name: 'Se déconnecter' }));
    expect(mockLogout).toHaveBeenCalledTimes(1);

    await fireEvent.press(
      view.getByRole('button', { name: 'Se déconnecter de tous les appareils' }),
    );
    expect(mockLogoutAllDevices).toHaveBeenCalledTimes(1);
  });

  it('presents the household as the heart of the screen: headcount and a human role label', async () => {
    const view = await renderScreen(<ProfileScreen />);

    await waitFor(() => expect(view.getByText('Vous êtes 2 dans ce nid')).toBeTruthy());
    expect(view.getByLabelText('Membres : Alix, Sam')).toBeTruthy();
    expect(view.getByText('Responsable du foyer')).toBeTruthy();
    expect(view.queryByText('OWNER')).toBeNull();
  });

  it('words a single-member household without a number', async () => {
    (mockApiClient.households.listMembers as jest.Mock).mockResolvedValue([TWO_MEMBERS[0]]);
    const view = await renderScreen(<ProfileScreen />);

    await waitFor(() =>
      expect(view.getByText('Pour l’instant, ce nid n’accueille que vous')).toBeTruthy(),
    );
  });

  it.each([
    ['ADMIN', 'Peut gérer le foyer'],
    ['MEMBER', 'Membre du foyer'],
  ] as const)('labels the %s role humanly', async (role, label) => {
    mockHouseholds = [{ ...LE_NID, role }];
    const view = await renderScreen(<ProfileScreen />);

    await waitFor(() => expect(view.getByText(label)).toBeTruthy());
  });

  it('offers « Inviter quelqu’un » inside the household card to an owner, and opens the invitations', async () => {
    const view = await renderScreen(<ProfileScreen />);
    await waitFor(() => expect(view.getByText('Le Nid')).toBeTruthy());

    await fireEvent.press(view.getByRole('button', { name: 'Inviter quelqu’un' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/profile/invitations');
  });

  it('never offers to invite to a plain member', async () => {
    mockHouseholds = [{ ...LE_NID, role: 'MEMBER' }];
    const view = await renderScreen(<ProfileScreen />);
    await waitFor(() => expect(view.getByText('Le Nid')).toBeTruthy());

    expect(view.queryByRole('button', { name: 'Inviter quelqu’un' })).toBeNull();
  });

  it('shows an error message when the households list fails to load', async () => {
    (mockApiClient.households.list as jest.Mock).mockRejectedValue(new Error('boom'));
    const view = await renderScreen(<ProfileScreen />);

    await waitFor(() => expect(view.getByText('Impossible de charger vos foyers.')).toBeTruthy());
  });
});
