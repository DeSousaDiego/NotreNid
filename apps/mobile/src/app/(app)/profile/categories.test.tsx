import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ToastProvider } from '../../../components';
import { ThemeProvider } from '../../../theme';

import CategoriesScreen from './categories';

// expo-image's module-level analytics-integration probing isn't compatible with
// this jest environment; the components barrel pulls it in via ItemCard even
// though this screen never renders one (see docs/PHASE_STATUS.md Phase 3B).
jest.mock('expo-image', () => ({ Image: () => null }));

const mockApiClient = createMockApiClient();

jest.mock('../../../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
}));

jest.mock('../../../providers/HouseholdProvider', () => ({
  useHousehold: () => ({
    householdId: 'household-1',
    households: [
      {
        id: 'household-1',
        name: 'Le Nid',
        createdById: 'user-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        role: 'OWNER' as const,
      },
    ],
    isLoading: false,
    isError: false,
    selectHousehold: jest.fn(),
    clearSelection: jest.fn(),
    refetch: jest.fn(),
  }),
}));

function createMockApiClient() {
  return {
    categories: { list: jest.fn() },
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

// V1 se limite aux 3 catégories système (Bloc 4), mais une catégorie personnalisée
// créée avant cette simplification doit encore pouvoir s'afficher en lecture seule
// (le backend n'a rien supprimé) — ce fixture couvre ce cas.
const VINYL_CATEGORY = {
  id: 'category-vinyl',
  householdId: 'household-1',
  name: 'Vinyles',
  slug: 'vinyles',
  icon: null,
  isSystem: false,
  metadataSchema: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
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

describe('CategoriesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the empty state when the household has no categories', async () => {
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([]);
    const view = await renderScreen(<CategoriesScreen />);

    await waitFor(() => expect(view.getByText('Aucune catégorie')).toBeTruthy());
  });

  it('shows an error state and retries on demand', async () => {
    (mockApiClient.categories.list as jest.Mock).mockRejectedValue(new Error('boom'));
    const view = await renderScreen(<CategoriesScreen />);

    await waitFor(() =>
      expect(view.getByText("Une erreur inattendue s'est produite.")).toBeTruthy(),
    );

    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([BOOK_CATEGORY]);
    await fireEvent.press(view.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(view.getByText('Livre')).toBeTruthy());
    expect(mockApiClient.categories.list).toHaveBeenCalledTimes(2);
  });

  it('lists categories in read-only, distinguishing system from custom ones (Bloc 4 — V1 = 3 catégories système)', async () => {
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([BOOK_CATEGORY, VINYL_CATEGORY]);
    const view = await renderScreen(<CategoriesScreen />);

    await waitFor(() => expect(view.getByText('Livre')).toBeTruthy());
    expect(view.getByText('Vinyles')).toBeTruthy();
    expect(view.getByText('Catégorie système')).toBeTruthy();
    expect(view.getByText('Catégorie personnalisée')).toBeTruthy();
  });

  it('never renders creation, edition or deletion affordances, even for an existing custom category', async () => {
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([BOOK_CATEGORY, VINYL_CATEGORY]);
    const view = await renderScreen(<CategoriesScreen />);

    await waitFor(() => expect(view.getByText('Vinyles')).toBeTruthy());
    expect(view.queryByText('Ajouter une catégorie')).toBeNull();
    expect(view.queryByLabelText('Modifier Vinyles')).toBeNull();
    expect(view.queryByLabelText('Supprimer Vinyles')).toBeNull();
  });
});
