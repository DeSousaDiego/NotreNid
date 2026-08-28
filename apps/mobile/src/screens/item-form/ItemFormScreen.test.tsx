import { NetworkError } from '@notre-nid/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ToastProvider } from '../../components';
import { ThemeProvider } from '../../theme';

import { ItemFormScreen } from './ItemFormScreen';

// expo-image's module-level analytics-integration probing isn't compatible
// with this jest environment (unrelated to what this test exercises) — stub
// it with a no-op component.
jest.mock('expo-image', () => ({ Image: () => null }));

const mockApiClient = createMockApiClient();

jest.mock('../../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
}));

jest.mock('../../providers/HouseholdProvider', () => ({
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

const mockRouterReplace = jest.fn();
const mockRouterBack = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    back: () => mockRouterBack(),
  },
}));

function createMockApiClient() {
  return {
    categories: { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() },
    households: { listMembers: jest.fn() },
    items: { create: jest.fn(), update: jest.fn(), get: jest.fn() },
  } as unknown as import('@notre-nid/api-client').ApiClient;
}

const BOOK_CATEGORY = {
  id: 'category-book',
  householdId: null,
  name: 'Livre',
  slug: 'book',
  icon: null,
  isSystem: true,
  metadataSchema: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const MEMBER = {
  id: 'member-1',
  role: 'OWNER' as const,
  joinedAt: '2026-01-01T00:00:00.000Z',
  user: {
    id: 'user-1',
    email: 'alix@example.com',
    displayName: 'Alix',
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

describe('ItemFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([BOOK_CATEGORY]);
    (mockApiClient.households.listMembers as jest.Mock).mockResolvedValue([MEMBER]);
  });

  it('blocks moving to step 2 until category, title and condition are valid', async () => {
    (mockApiClient.items.create as jest.Mock).mockResolvedValue({ id: 'item-1' });
    const view = await renderScreen(<ItemFormScreen mode="create" />);

    await waitFor(() => expect(view.getByText('Livre')).toBeTruthy());

    await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));

    await waitFor(() => expect(view.getByText('Le titre est requis.')).toBeTruthy());
    expect(mockApiClient.items.create).not.toHaveBeenCalled();
  });

  it('creates the item end-to-end across all three steps', async () => {
    (mockApiClient.items.create as jest.Mock).mockResolvedValue({ id: 'item-1' });
    const view = await renderScreen(<ItemFormScreen mode="create" />);

    await waitFor(() => expect(view.getByText('Livre')).toBeTruthy());

    await fireEvent.press(view.getByLabelText('Livre'));
    await fireEvent.changeText(view.getByLabelText('Titre'), 'Dune');

    await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
    await waitFor(() => expect(view.getByText('Auteur')).toBeTruthy());

    await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
    await waitFor(() => expect(view.getByText('Alix')).toBeTruthy());

    await fireEvent.press(view.getByRole('button', { name: 'Alix' }));
    await fireEvent.press(view.getByRole('button', { name: 'Ajouter au nid' }));

    await waitFor(() => expect(mockApiClient.items.create).toHaveBeenCalledTimes(1));
    expect(mockApiClient.items.create).toHaveBeenCalledWith(
      'household-1',
      expect.objectContaining({
        categoryId: 'category-book',
        title: 'Dune',
        ownerIds: ['user-1'],
      }),
    );
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/(app)/collection'));
  });

  it('shows a retryable error state instead of a blank category picker when the categories request fails', async () => {
    (mockApiClient.categories.list as jest.Mock).mockRejectedValue(new NetworkError());
    const view = await renderScreen(<ItemFormScreen mode="create" />);

    await waitFor(() => expect(view.getByText('Catégories indisponibles')).toBeTruthy());
    expect(
      view.getByText('Impossible de joindre le service. Vérifiez votre connexion et réessayez.'),
    ).toBeTruthy();
    expect(view.queryByText('Livre')).toBeNull();

    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([BOOK_CATEGORY]);
    await fireEvent.press(view.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(view.getByText('Livre')).toBeTruthy());
  });

  it('shows a retryable error state instead of silently emptying the owner picker when the members request fails', async () => {
    (mockApiClient.households.listMembers as jest.Mock).mockRejectedValue(new NetworkError());
    const view = await renderScreen(<ItemFormScreen mode="create" />);

    await waitFor(() => expect(view.getByText('Membres indisponibles')).toBeTruthy());
    expect(view.queryByText('Livre')).toBeNull();
  });
});
