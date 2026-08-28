import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ToastProvider } from '../../../components';
import { ThemeProvider } from '../../../theme';

import InvitationsScreen from './invitations';

// expo-image's module-level analytics-integration probing isn't compatible with
// this jest environment; the components barrel pulls it in via ItemCard even
// though this screen never renders one (see docs/PHASE_STATUS.md Phase 3B).
jest.mock('expo-image', () => ({ Image: () => null }));

const mockApiClient = createMockApiClient();

jest.mock('../../../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
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

const PENDING_INVITATION = {
  id: 'inv-1',
  householdId: 'household-1',
  email: 'sam@example.com',
  invitedById: 'user-1',
  expiresAt: '2026-03-15T12:00:00.000Z',
  acceptedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
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

describe('InvitationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentRole = 'OWNER';
  });

  it('blocks access for a plain member', async () => {
    mockCurrentRole = 'MEMBER';
    (mockApiClient.invitations.list as jest.Mock).mockResolvedValue([]);
    const view = await renderScreen(<InvitationsScreen />);

    await waitFor(() => expect(view.getByText('Accès réservé')).toBeTruthy());
  });

  it('shows the empty state when there are no pending invitations', async () => {
    (mockApiClient.invitations.list as jest.Mock).mockResolvedValue([]);
    const view = await renderScreen(<InvitationsScreen />);

    await waitFor(() => expect(view.getByText('Aucune invitation en attente')).toBeTruthy());
  });

  it('lists pending invitations and hides already-accepted ones', async () => {
    (mockApiClient.invitations.list as jest.Mock).mockResolvedValue([
      PENDING_INVITATION,
      {
        ...PENDING_INVITATION,
        id: 'inv-2',
        email: 'accepted@example.com',
        acceptedAt: '2026-01-05T00:00:00.000Z',
      },
    ]);
    const view = await renderScreen(<InvitationsScreen />);

    await waitFor(() => expect(view.getByText('sam@example.com')).toBeTruthy());
    expect(view.queryByText('accepted@example.com')).toBeNull();
    expect(view.getByText(/Expire le/)).toBeTruthy();
  });

  it('rejects an invalid email before calling the API', async () => {
    (mockApiClient.invitations.list as jest.Mock).mockResolvedValue([]);
    const view = await renderScreen(<InvitationsScreen />);

    await waitFor(() => expect(view.getByText('Aucune invitation en attente')).toBeTruthy());

    await fireEvent.changeText(view.getByLabelText('Inviter par email'), 'not-an-email');
    await fireEvent.press(view.getByRole('button', { name: "Envoyer l'invitation" }));

    await waitFor(() => expect(view.getByText('Adresse email invalide.')).toBeTruthy());
    expect(mockApiClient.invitations.create).not.toHaveBeenCalled();
  });

  it('creates an invitation and displays the shareable link when the email was delivered', async () => {
    (mockApiClient.invitations.list as jest.Mock).mockResolvedValue([]);
    (mockApiClient.invitations.create as jest.Mock).mockResolvedValue({
      id: 'inv-3',
      token: 'raw-dev-token',
      emailDelivered: true,
    });
    const view = await renderScreen(<InvitationsScreen />);

    await waitFor(() => expect(view.getByText('Aucune invitation en attente')).toBeTruthy());

    await fireEvent.changeText(view.getByLabelText('Inviter par email'), 'sam@example.com');
    await fireEvent.press(view.getByRole('button', { name: "Envoyer l'invitation" }));

    await waitFor(() =>
      expect(mockApiClient.invitations.create).toHaveBeenCalledWith(
        'household-1',
        'sam@example.com',
      ),
    );
    await waitFor(() => expect(view.getByText('raw-dev-token')).toBeTruthy());
    expect(view.getByText('Cette invitation a aussi été envoyée par email.')).toBeTruthy();
  });

  it('still shows the token to share manually when the invitation email fails to send', async () => {
    (mockApiClient.invitations.list as jest.Mock).mockResolvedValue([]);
    (mockApiClient.invitations.create as jest.Mock).mockResolvedValue({
      id: 'inv-4',
      token: 'raw-fallback-token',
      emailDelivered: false,
    });
    const view = await renderScreen(<InvitationsScreen />);

    await waitFor(() => expect(view.getByText('Aucune invitation en attente')).toBeTruthy());

    await fireEvent.changeText(view.getByLabelText('Inviter par email'), 'sam@example.com');
    await fireEvent.press(view.getByRole('button', { name: "Envoyer l'invitation" }));

    await waitFor(() => expect(view.getByText('raw-fallback-token')).toBeTruthy());
    expect(
      view.getByText(
        "L'email n'a pas pu être envoyé. Partagez ce code manuellement avec la personne invitée.",
      ),
    ).toBeTruthy();
  });

  it('revokes an invitation after confirming the destructive dialog', async () => {
    (mockApiClient.invitations.list as jest.Mock).mockResolvedValue([PENDING_INVITATION]);
    (mockApiClient.invitations.revoke as jest.Mock).mockResolvedValue(undefined);
    const view = await renderScreen(<InvitationsScreen />);

    await waitFor(() => expect(view.getByText('sam@example.com')).toBeTruthy());

    await fireEvent.press(view.getByLabelText("Révoquer l'invitation envoyée à sam@example.com"));
    await waitFor(() => expect(view.getByText('Révoquer cette invitation ?')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Révoquer' }));

    await waitFor(() => expect(mockApiClient.invitations.revoke).toHaveBeenCalledWith('inv-1'));
  });
});
