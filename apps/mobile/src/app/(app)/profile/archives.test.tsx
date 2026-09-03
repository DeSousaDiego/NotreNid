import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { mockItem } from '../../../test-utils/mockItem';
import { ThemeProvider } from '../../../theme';

import ArchivesScreen from './archives';

// expo-image's module-level analytics-integration probing isn't compatible with
// this jest environment (see docs/PHASE_STATUS.md Phase 3B) — this screen
// renders ItemCard, which imports expo-image directly.
jest.mock('expo-image', () => ({ Image: () => null }));

const mockApiClient = createMockApiClient();

jest.mock('../../../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('../../../providers/HouseholdProvider', () => ({
  useHousehold: () => ({
    householdId: 'household-1',
    households: [],
    isLoading: false,
    isError: false,
    selectHousehold: jest.fn(),
    clearSelection: jest.fn(),
    refetch: jest.fn(),
  }),
}));

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
}));

function createMockApiClient() {
  return {
    items: { list: jest.fn() },
  } as unknown as import('@notre-nid/api-client').ApiClient;
}

function pageOf(items: ReturnType<typeof mockItem>[]) {
  return {
    data: items,
    meta: { page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 },
  };
}

function renderScreen(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider fontsLoaded={false}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('ArchivesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows neither content nor the empty state while the archived items are still loading', async () => {
    (mockApiClient.items.list as jest.Mock).mockReturnValue(new Promise(() => {}));
    const view = await renderScreen(<ArchivesScreen />);

    expect(view.queryByText('Aucun objet archivé')).toBeNull();
    expect(view.queryByText('Les Misérables')).toBeNull();
  });

  it('shows the empty state when there are no archived items', async () => {
    (mockApiClient.items.list as jest.Mock).mockResolvedValue(pageOf([]));
    const view = await renderScreen(<ArchivesScreen />);

    await waitFor(() => expect(view.getByText('Aucun objet archivé')).toBeTruthy());
  });

  it('shows an error state and retries on demand', async () => {
    (mockApiClient.items.list as jest.Mock).mockRejectedValue(new Error('boom'));
    const view = await renderScreen(<ArchivesScreen />);

    await waitFor(() =>
      expect(view.getByText("Une erreur inattendue s'est produite.")).toBeTruthy(),
    );

    (mockApiClient.items.list as jest.Mock).mockResolvedValue(
      pageOf([mockItem({ archivedAt: '2026-02-01T00:00:00.000Z' })]),
    );
    await fireEvent.press(view.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(view.getByText('Les Misérables')).toBeTruthy());
  });

  it('lists archived items and navigates to the detail screen on press', async () => {
    const archivedItem = mockItem({ id: 'item-42', archivedAt: '2026-02-01T00:00:00.000Z' });
    (mockApiClient.items.list as jest.Mock).mockResolvedValue(pageOf([archivedItem]));
    const view = await renderScreen(<ArchivesScreen />);

    await waitFor(() => expect(view.getByText('Les Misérables')).toBeTruthy());
    expect(mockApiClient.items.list).toHaveBeenCalledWith(
      'household-1',
      expect.objectContaining({ archived: true }),
    );

    await fireEvent.press(view.getByRole('button', { name: 'Les Misérables, Livre' }));

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/(app)/collection/[itemId]',
      params: { itemId: 'item-42' },
    });
  });
});
