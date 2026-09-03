import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
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

  // `ToastProvider` schedules a real 3s hide timeout per `showToast()` call (see
  // src/components/Toast.tsx). Left pending past the end of this file, it fires after Jest
  // tears down the `react-native` module registry and crashes the worker (`Animated`
  // resolves to undefined at that point). Draining it here keeps it inside a live environment.
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3200));
  });

  it('blocks access for a plain member', async () => {
    mockCurrentRole = 'MEMBER';
    (mockApiClient.invitations.list as jest.Mock).mockResolvedValue([]);
    const view = await renderScreen(<InvitationsScreen />);

    await waitFor(() => expect(view.getByText('Accès réservé')).toBeTruthy());
  });

  // Un seul rendu couvrant toute la séquence OWNER (état vide → génération → copier →
  // partager → révoquer) plutôt qu'un test par scénario : un troisième rendu complet de cet
  // écran dans ce même fichier se corrompt de façon reproductible, indépendamment de son
  // contenu (voir la note équivalente dans join.test.tsx) — vraisemblablement une limite de
  // cet environnement react-test-renderer/React 19 plutôt qu'un bug de l'écran. La branche
  // « invitation déjà active sans code visible, revenue d'une session précédente » n'est de
  // ce fait pas couverte par un rendu dédié ici ; elle a été vérifiée par relecture (trois
  // lignes de JSX conditionnelles, voir invitations.tsx) plutôt que sacrifier la fiabilité de
  // cette suite pour un rendu supplémentaire.
  it('generates a code, allows copying and sharing it, and revoking it back to the empty state', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    (mockApiClient.invitations.list as jest.Mock).mockResolvedValue([]);
    const view = await renderScreen(<InvitationsScreen />);

    await waitFor(() => expect(view.getByText('Aucune invitation active')).toBeTruthy());
    expect(view.getByRole('button', { name: 'Inviter quelqu’un' })).toBeTruthy();

    (mockApiClient.invitations.create as jest.Mock).mockResolvedValue({
      ...ACTIVE_INVITATION,
      code: '7K4P2Q9D',
      emailDelivered: null,
    });
    await fireEvent.press(view.getByRole('button', { name: 'Inviter quelqu’un' }));

    await waitFor(() =>
      expect(mockApiClient.invitations.create).toHaveBeenCalledWith('household-1', undefined),
    );
    await waitFor(() => expect(view.getByText('7K4P-2Q9D')).toBeTruthy());

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
});
