import { ApiError } from '@notre-nid/api-client';
import type { HouseholdMember } from '@notre-nid/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
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

const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockRouterReplace(...args) },
}));

// Foyer courant observable (comme le vrai `HouseholdProvider`) : permet de simuler la
// bascule automatique vers un autre foyer une fois celui-ci quitté.
let mockHouseholdId = 'household-1';
const mockHouseholdListeners = new Set<() => void>();
function mockSetHouseholdId(id: string) {
  mockHouseholdId = id;
  mockHouseholdListeners.forEach((listener) => listener());
}
function mockSubscribeHousehold(listener: () => void) {
  mockHouseholdListeners.add(listener);
  return () => mockHouseholdListeners.delete(listener);
}
const mockClearSelection = jest.fn();
let mockCurrentRole: 'OWNER' | 'ADMIN' | 'MEMBER' = 'OWNER';

jest.mock('../../../providers/HouseholdProvider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useHousehold: () => {
      const householdId = React.useSyncExternalStore(mockSubscribeHousehold, () => mockHouseholdId);
      return {
        householdId,
        households: [
          { id: 'household-1', name: 'Le Nid', role: mockCurrentRole },
          { id: 'household-2', name: 'Le Chalet', role: 'OWNER' },
        ],
        isLoading: false,
        isError: false,
        selectHousehold: jest.fn(),
        clearSelection: mockClearSelection,
        refetch: jest.fn(),
      };
    },
  };
});

function createMockApiClient() {
  return {
    households: {
      list: jest.fn(),
      listMembers: jest.fn(),
      updateMemberRole: jest.fn(),
      removeMember: jest.fn(),
      leave: jest.fn(),
    },
  } as unknown as import('@notre-nid/api-client').ApiClient;
}

function member(
  id: string,
  displayName: string,
  role: HouseholdMember['role'],
  userId = `user-${id}`,
): HouseholdMember {
  return {
    id: `member-${id}`,
    role,
    joinedAt: '2026-01-01T00:00:00.000Z',
    user: { ...mockUser, id: userId, displayName, email: `${id}@example.com` },
  };
}

const ALIX_OWNER = member('1', 'Alix', 'OWNER', 'user-1');
const ALIX_MEMBER = member('1', 'Alix', 'MEMBER', 'user-1');
const SAM_MEMBER = member('2', 'Sam', 'MEMBER');
const SAM_OWNER = member('2', 'Sam', 'OWNER');
const CHARLIE_OTHER_HOUSEHOLD = member('3', 'Charlie', 'OWNER');

const listMembers = () => mockApiClient.households.listMembers as jest.Mock;
const updateMemberRole = () => mockApiClient.households.updateMemberRole as jest.Mock;

async function renderScreen(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = await render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider fontsLoaded={false}>
        <ToastProvider>{ui}</ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { view, queryClient };
}

async function openManagementSheetForSam(view: Awaited<ReturnType<typeof render>>) {
  await waitFor(() => expect(view.getByText('Sam')).toBeTruthy());
  await fireEvent.press(view.getByLabelText('Gérer Sam'));
  await waitFor(() => expect(view.getByRole('button', { name: 'Administrateur' })).toBeTruthy());
}

describe('MembersScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHouseholdId = 'household-1';
    mockCurrentRole = 'OWNER';
  });

  // `ToastProvider` schedules a real 3s hide timeout per `showToast()` call (see
  // src/components/Toast.tsx). Left pending past the end of this file, it fires after Jest
  // tears down the `react-native` module registry and crashes the worker. Draining it here
  // keeps it inside a live environment (same note as join.test.tsx).
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3200));
  });

  it('renders the member list with roles, marking the current user', async () => {
    listMembers().mockResolvedValue([ALIX_OWNER, SAM_MEMBER]);
    const { view } = await renderScreen(<MembersScreen />);

    await waitFor(() => expect(view.getByText('Alix (vous)')).toBeTruthy());
    expect(view.getByText('Sam')).toBeTruthy();
    expect(view.getByText('Propriétaire')).toBeTruthy();
    expect(view.getByText('Membre')).toBeTruthy();
  });

  it('shows an error state without any data and retries on demand', async () => {
    listMembers().mockRejectedValue(new Error('boom'));
    const { view } = await renderScreen(<MembersScreen />);

    await waitFor(() =>
      expect(view.getByText("Une erreur inattendue s'est produite.")).toBeTruthy(),
    );

    listMembers().mockResolvedValue([ALIX_OWNER]);
    await fireEvent.press(view.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(view.getByText('Alix (vous)')).toBeTruthy());
    expect(listMembers()).toHaveBeenCalledTimes(2);
  });

  it('keeps the known member list visible when a refetch fails', async () => {
    listMembers().mockResolvedValueOnce([ALIX_OWNER, SAM_MEMBER]);
    const { view, queryClient } = await renderScreen(<MembersScreen />);
    await waitFor(() => expect(view.getByText('Sam')).toBeTruthy());

    listMembers().mockRejectedValue(new Error('offline'));
    await act(() => queryClient.refetchQueries());

    expect(listMembers()).toHaveBeenCalledTimes(2);
    expect(view.getByText('Sam')).toBeTruthy();
    expect(view.getByText('Alix (vous)')).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Réessayer' })).toBeNull();
  });

  it('changes a member role from the management sheet', async () => {
    listMembers().mockResolvedValue([ALIX_OWNER, SAM_MEMBER]);
    updateMemberRole().mockResolvedValue({});
    const { view } = await renderScreen(<MembersScreen />);

    await openManagementSheetForSam(view);
    await fireEvent.press(view.getByRole('button', { name: 'Administrateur' }));

    await waitFor(() =>
      expect(updateMemberRole()).toHaveBeenCalledWith('household-1', 'user-2', 'ADMIN'),
    );
    expect(updateMemberRole()).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the already active role chip is pressed', async () => {
    listMembers().mockResolvedValue([ALIX_OWNER, SAM_MEMBER]);
    const { view } = await renderScreen(<MembersScreen />);

    await openManagementSheetForSam(view);
    await fireEvent.press(view.getByRole('button', { name: 'Membre' }));

    expect(updateMemberRole()).not.toHaveBeenCalled();
    expect(view.queryByText('Rôle mis à jour.')).toBeNull();
  });

  it('asks for confirmation before promoting a member to owner, and promotes only once confirmed', async () => {
    listMembers().mockResolvedValue([ALIX_OWNER, SAM_MEMBER]);
    updateMemberRole().mockResolvedValue({});
    const { view } = await renderScreen(<MembersScreen />);

    await openManagementSheetForSam(view);
    await fireEvent.press(view.getByRole('button', { name: 'Propriétaire' }));
    await waitFor(() =>
      expect(view.getByText('Donner à Sam la responsabilité du foyer ?')).toBeTruthy(),
    );
    expect(
      view.getByText('Cette personne pourra gérer les membres et les invitations.'),
    ).toBeTruthy();
    expect(updateMemberRole()).not.toHaveBeenCalled();

    await fireEvent.press(view.getByRole('button', { name: 'Annuler' }));
    await waitFor(() =>
      expect(view.queryByText('Donner à Sam la responsabilité du foyer ?')).toBeNull(),
    );
    expect(updateMemberRole()).not.toHaveBeenCalled();

    await fireEvent.press(view.getByRole('button', { name: 'Propriétaire' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Confirmer' })).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Confirmer' }));

    await waitFor(() =>
      expect(updateMemberRole()).toHaveBeenCalledWith('household-1', 'user-2', 'OWNER'),
    );
    await waitFor(() => expect(view.getByText('Rôle mis à jour.')).toBeTruthy());
    expect(updateMemberRole()).toHaveBeenCalledTimes(1);
  });

  it('removes a member after confirming the destructive dialog', async () => {
    listMembers().mockResolvedValue([ALIX_OWNER, SAM_MEMBER]);
    (mockApiClient.households.removeMember as jest.Mock).mockResolvedValue(undefined);
    const { view } = await renderScreen(<MembersScreen />);

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

  it('never offers to leave when the current user is the last owner', async () => {
    listMembers().mockResolvedValue([ALIX_OWNER, SAM_MEMBER]);
    const { view } = await renderScreen(<MembersScreen />);

    await waitFor(() =>
      expect(
        view.getByText('Pour quitter ce foyer, confiez-le d’abord à quelqu’un d’autre.'),
      ).toBeTruthy(),
    );
    expect(view.queryByRole('button', { name: 'Quitter ce foyer' })).toBeNull();
  });

  it('offers to leave when another owner remains', async () => {
    listMembers().mockResolvedValue([ALIX_OWNER, SAM_OWNER]);
    const { view } = await renderScreen(<MembersScreen />);

    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Quitter ce foyer' })).toBeTruthy(),
    );
    expect(
      view.queryByText('Pour quitter ce foyer, confiez-le d’abord à quelqu’un d’autre.'),
    ).toBeNull();
  });

  it('offers to leave to a plain member', async () => {
    mockCurrentRole = 'MEMBER';
    listMembers().mockResolvedValue([SAM_OWNER, ALIX_MEMBER]);
    const { view } = await renderScreen(<MembersScreen />);

    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Quitter ce foyer' })).toBeTruthy(),
    );
    // Un simple membre ne gère personne.
    expect(view.queryByLabelText('Gérer Sam')).toBeNull();
  });

  it('leaves, then clears the selection and goes home without ever showing the next household', async () => {
    mockCurrentRole = 'MEMBER';
    listMembers().mockImplementation((householdId: string) =>
      Promise.resolve(
        householdId === 'household-1' ? [SAM_OWNER, ALIX_MEMBER] : [CHARLIE_OTHER_HOUSEHOLD],
      ),
    );
    // Pendant la mutation, `useLeaveHousehold` retire le foyer quitté de la liste :
    // `HouseholdProvider` bascule alors automatiquement sur le foyer restant.
    (mockApiClient.households.leave as jest.Mock).mockImplementation(async () => {
      mockSetHouseholdId('household-2');
    });
    const { view } = await renderScreen(<MembersScreen />);

    await waitFor(() => expect(view.getByText('Alix (vous)')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Quitter ce foyer' }));
    await waitFor(() => expect(view.getByText('Quitter ce foyer ?')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Quitter' }));

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/'));
    expect(mockApiClient.households.leave).toHaveBeenCalledWith('household-1');
    expect(mockClearSelection).toHaveBeenCalledTimes(1);
    const leaveOrder = (mockApiClient.households.leave as jest.Mock).mock.invocationCallOrder[0];
    expect(mockClearSelection.mock.invocationCallOrder[0]).toBeGreaterThan(leaveOrder as number);
    expect(mockRouterReplace.mock.invocationCallOrder[0]).toBeGreaterThan(
      mockClearSelection.mock.invocationCallOrder[0] as number,
    );
    expect(view.queryByText('Charlie')).toBeNull();
    expect(view.queryByText('Alix (vous)')).toBeNull();
  });

  it('shows a clear message and stays put when the API refuses the departure', async () => {
    listMembers().mockResolvedValue([ALIX_OWNER, SAM_OWNER]);
    (mockApiClient.households.leave as jest.Mock).mockRejectedValue(
      new ApiError({
        statusCode: 409,
        code: 'LAST_OWNER_CANNOT_LEAVE',
        message: "Le dernier propriétaire d'un household ne peut ni le quitter.",
        details: [],
      }),
    );
    const { view } = await renderScreen(<MembersScreen />);

    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Quitter ce foyer' })).toBeTruthy(),
    );
    await fireEvent.press(view.getByRole('button', { name: 'Quitter ce foyer' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Quitter' })).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Quitter' }));

    await waitFor(() =>
      expect(
        view.getByText(
          'Vous êtes la seule personne responsable de ce foyer : confiez-le d’abord à quelqu’un d’autre.',
        ),
      ).toBeTruthy(),
    );
    expect(mockClearSelection).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(view.getByText('Alix (vous)')).toBeTruthy();
  });
});
