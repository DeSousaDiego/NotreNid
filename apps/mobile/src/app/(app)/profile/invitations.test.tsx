import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import type { ReactElement } from 'react';
import { Share } from 'react-native';

import { ToastProvider } from '../../../components';
import { ThemeProvider } from '../../../theme';

import InvitationsScreen from './invitations';

// expo-image's module-level analytics-integration probing isn't compatible with
// this jest environment; the components barrel pulls it in via ItemCard even
// though this screen never renders one (see docs/PHASE_STATUS.md Phase 3B).
jest.mock('expo-image', () => ({ Image: () => null }));

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(undefined) }));

const mockApiClient = createMockApiClient();

jest.mock('../../../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

let mockCurrentRole: 'OWNER' | 'ADMIN' | 'MEMBER' = 'OWNER';
const mockHouseholds = () => [
  {
    id: 'household-1',
    name: 'Le Nid',
    createdById: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    role: mockCurrentRole,
  },
];

jest.mock('../../../providers/HouseholdProvider', () => ({
  useHousehold: () => ({
    householdId: 'household-1',
    households: mockHouseholds(),
    isLoading: false,
    isError: false,
    selectHousehold: jest.fn(),
    clearSelection: jest.fn(),
    refetch: jest.fn(),
  }),
}));

function createMockApiClient() {
  return {
    invitations: {
      list: jest.fn(),
      create: jest.fn(),
      revoke: jest.fn(),
    },
  } as unknown as import('@notre-nid/api-client').ApiClient;
}

const ACTIVE_INVITATION = {
  id: 'inv-1',
  householdId: 'household-1',
  email: null,
  invitedById: 'user-1',
  expiresAt: '2026-03-15T12:00:00.000Z',
  acceptedAt: null,
  revokedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  status: 'pending' as const,
};

const CREATED_INVITATION = { ...ACTIVE_INVITATION, code: '7K4P2Q9D', emailDelivered: null };

const listInvitations = () => mockApiClient.invitations.list as jest.Mock;

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

describe('InvitationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentRole = 'OWNER';
  });

  // `ToastProvider` schedules a real 3s hide timeout per `showToast()` call (see
  // src/components/Toast.tsx). Left pending past the end of this file, it fires after Jest
  // tears down the `react-native` module registry and crashes the worker (`Animated`
  // resolves to undefined at that point). Draining it here keeps it inside a live environment.
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3200));
  });

  it('blocks access for a plain member without ever requesting the invitations', async () => {
    mockCurrentRole = 'MEMBER';
    listInvitations().mockResolvedValue([]);
    const { view } = await renderScreen(<InvitationsScreen />);

    await waitFor(() => expect(view.getByText('Accès réservé')).toBeTruthy());
    expect(listInvitations()).not.toHaveBeenCalled();
  });

  it('shows a full error state only when no invitation data was ever loaded', async () => {
    listInvitations().mockRejectedValue(new Error('boom'));
    const { view } = await renderScreen(<InvitationsScreen />);

    await waitFor(() =>
      expect(view.getByText("Une erreur inattendue s'est produite.")).toBeTruthy(),
    );
    expect(listInvitations()).toHaveBeenCalledWith('household-1');
    expect(view.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('keeps an already known active invitation visible when a refetch fails', async () => {
    listInvitations().mockResolvedValueOnce([ACTIVE_INVITATION]);
    const { view, queryClient } = await renderScreen(<InvitationsScreen />);
    await waitFor(() => expect(view.getByText('Un code est déjà actif')).toBeTruthy());

    listInvitations().mockRejectedValue(new Error('offline'));
    await act(() => queryClient.refetchQueries());

    expect(listInvitations()).toHaveBeenCalledTimes(2);
    expect(view.getByText('Un code est déjà actif')).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Réessayer' })).toBeNull();
  });

  it('keeps the freshly created code visible even when the refetch that follows fails, then copies, shares and revokes it', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    listInvitations().mockResolvedValueOnce([]);
    const { view } = await renderScreen(<InvitationsScreen />);

    await waitFor(() => expect(view.getByText('Aucune invitation active')).toBeTruthy());

    // Le refetch déclenché par l'invalidation post-création échoue (réseau instable).
    listInvitations().mockRejectedValue(new Error('offline'));
    (mockApiClient.invitations.create as jest.Mock).mockResolvedValue(CREATED_INVITATION);
    await fireEvent.press(view.getByRole('button', { name: 'Inviter quelqu’un' }));

    await waitFor(() =>
      expect(mockApiClient.invitations.create).toHaveBeenCalledWith('household-1', undefined),
    );
    await waitFor(() => expect(listInvitations()).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(view.getByText('7K4P-2Q9D')).toBeTruthy());
    expect(view.queryByRole('button', { name: 'Réessayer' })).toBeNull();

    await fireEvent.press(view.getByRole('button', { name: 'Copier' }));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('7K4P-2Q9D'));
    await waitFor(() => expect(view.getByText('Code copié')).toBeTruthy());

    await fireEvent.press(view.getByRole('button', { name: 'Partager' }));
    await waitFor(() =>
      expect(shareSpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('7K4P-2Q9D') }),
      ),
    );

    (mockApiClient.invitations.revoke as jest.Mock).mockResolvedValue(undefined);
    await fireEvent.press(view.getByRole('button', { name: 'Révoquer ce code' }));
    await waitFor(() => expect(view.getByText('Révoquer ce code ?')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Révoquer' }));

    await waitFor(() => expect(mockApiClient.invitations.revoke).toHaveBeenCalledWith('inv-1'));
    await waitFor(() => expect(view.getByText('Aucune invitation active')).toBeTruthy());
  });

  it('reports copy and share failures, but stays silent when the share sheet is simply dismissed', async () => {
    listInvitations().mockResolvedValue([]);
    (mockApiClient.invitations.create as jest.Mock).mockResolvedValue(CREATED_INVITATION);
    const { view } = await renderScreen(<InvitationsScreen />);

    await waitFor(() => expect(view.getByText('Aucune invitation active')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Inviter quelqu’un' }));
    await waitFor(() => expect(view.getByText('7K4P-2Q9D')).toBeTruthy());

    (Clipboard.setStringAsync as jest.Mock).mockRejectedValueOnce(new Error('clipboard'));
    await fireEvent.press(view.getByRole('button', { name: 'Copier' }));
    await waitFor(() =>
      expect(
        view.getByText('Impossible de copier le code. Vous pouvez le sélectionner à la main.'),
      ).toBeTruthy(),
    );
    expect(view.queryByText('Code copié')).toBeNull();

    const shareSpy = jest
      .spyOn(Share, 'share')
      .mockResolvedValueOnce({ action: 'dismissedAction' });
    await fireEvent.press(view.getByRole('button', { name: 'Partager' }));
    await waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));
    expect(
      view.queryByText('Impossible d’ouvrir le partage. Copiez le code à la place.'),
    ).toBeNull();

    shareSpy.mockRejectedValueOnce(new Error('share'));
    await fireEvent.press(view.getByRole('button', { name: 'Partager' }));
    await waitFor(() =>
      expect(
        view.getByText('Impossible d’ouvrir le partage. Copiez le code à la place.'),
      ).toBeTruthy(),
    );
    // Le code reste affiché : l'échec du partage ne le fait jamais disparaître.
    expect(view.getByText('7K4P-2Q9D')).toBeTruthy();
  });
});
