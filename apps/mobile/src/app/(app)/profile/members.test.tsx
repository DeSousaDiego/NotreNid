import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ToastProvider } from '../../../components';
import { ThemeProvider } from '../../../theme';

import MembersScreen from './members';

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

jest.mock('../../../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
  useAuth: () => ({ user: mockUser }),
}));

const mockClearSelection = jest.fn();
const mockHouseholds = [
  {
    id: 'household-1',
    name: 'Le Nid',
    createdById: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    role: 'OWNER' as const,
  },
];

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

function createMockApiClient() {
  return {
    households: {
      listMembers: jest.fn(),
      updateMemberRole: jest.fn(),
      removeMember: jest.fn(),
      leave: jest.fn(),
    },
  } as unknown as import('@notre-nid/api-client').ApiClient;
}

const OWNER_MEMBER = {
  id: 'member-1',
  role: 'OWNER' as const,
  joinedAt: '2026-01-01T00:00:00.000Z',
  user: mockUser,
};

const SAM_MEMBER = {
  id: 'member-2',
  role: 'MEMBER' as const,
  joinedAt: '2026-01-02T00:00:00.000Z',
  user: {
    id: 'user-2',
    email: 'sam@example.com',
    displayName: 'Sam',
    avatarUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
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

describe('MembersScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the member list with roles, marking the current user', async () => {
    (mockApiClient.households.listMembers as jest.Mock).mockResolvedValue([
      OWNER_MEMBER,
      SAM_MEMBER,
    ]);
    const view = await renderScreen(<MembersScreen />);

    await waitFor(() => expect(view.getByText('Alix (vous)')).toBeTruthy());
    expect(view.getByText('Sam')).toBeTruthy();
    expect(view.getByText('Propriétaire')).toBeTruthy();
    expect(view.getByText('Membre')).toBeTruthy();
  });

  it('shows the empty state when the household has no members', async () => {
    (mockApiClient.households.listMembers as jest.Mock).mockResolvedValue([]);
    const view = await renderScreen(<MembersScreen />);

    await waitFor(() => expect(view.getByText('Aucun membre')).toBeTruthy());
  });

  it('shows an error state and retries on demand', async () => {
    (mockApiClient.households.listMembers as jest.Mock).mockRejectedValue(new Error('boom'));
    const view = await renderScreen(<MembersScreen />);

    await waitFor(() =>
      expect(view.getByText("Une erreur inattendue s'est produite.")).toBeTruthy(),
    );

    (mockApiClient.households.listMembers as jest.Mock).mockResolvedValue([OWNER_MEMBER]);
    await fireEvent.press(view.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(view.getByText('Alix (vous)')).toBeTruthy());
    expect(mockApiClient.households.listMembers).toHaveBeenCalledTimes(2);
  });

  it('changes a member role from the management sheet', async () => {
    (mockApiClient.households.listMembers as jest.Mock).mockResolvedValue([
      OWNER_MEMBER,
      SAM_MEMBER,
    ]);
    (mockApiClient.households.updateMemberRole as jest.Mock).mockResolvedValue({});
    const view = await renderScreen(<MembersScreen />);

    await waitFor(() => expect(view.getByText('Sam')).toBeTruthy());

    await fireEvent.press(view.getByLabelText('Gérer Sam'));
    await waitFor(() => expect(view.getByRole('button', { name: 'Administrateur' })).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Administrateur' }));

    await waitFor(() =>
      expect(mockApiClient.households.updateMemberRole).toHaveBeenCalledWith(
        'household-1',
        'user-2',
        'ADMIN',
      ),
    );
  });

  it('removes a member after confirming the destructive dialog', async () => {
    (mockApiClient.households.listMembers as jest.Mock).mockResolvedValue([
      OWNER_MEMBER,
      SAM_MEMBER,
    ]);
    (mockApiClient.households.removeMember as jest.Mock).mockResolvedValue(undefined);
    const view = await renderScreen(<MembersScreen />);

    await waitFor(() => expect(view.getByText('Sam')).toBeTruthy());

    await fireEvent.press(view.getByLabelText('Gérer Sam'));
    await waitFor(() => expect(view.getByText('Retirer du foyer')).toBeTruthy());
    await fireEvent.press(view.getByText('Retirer du foyer'));

    await waitFor(() => expect(view.getByText('Retirer ce membre ?')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Retirer' }));

    await waitFor(() =>
      expect(mockApiClient.households.removeMember).toHaveBeenCalledWith('household-1', 'user-2'),
    );
  });

  it('leaves the household after confirming', async () => {
    (mockApiClient.households.listMembers as jest.Mock).mockResolvedValue([OWNER_MEMBER]);
    (mockApiClient.households.leave as jest.Mock).mockResolvedValue(undefined);
    const view = await renderScreen(<MembersScreen />);

    await waitFor(() => expect(view.getByText('Alix (vous)')).toBeTruthy());

    await fireEvent.press(view.getByRole('button', { name: 'Quitter ce foyer' }));
    await waitFor(() => expect(view.getByText('Quitter ce foyer ?')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Quitter' }));

    await waitFor(() => expect(mockApiClient.households.leave).toHaveBeenCalledWith('household-1'));
    expect(mockClearSelection).toHaveBeenCalledTimes(1);
  });
});
