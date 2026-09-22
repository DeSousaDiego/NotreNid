import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { CollectionFiltersProvider } from '../../../../providers/CollectionFiltersProvider';
import { ThemeProvider } from '../../../../theme';

import CollectionScreen from './index';

// expo-image's module-level analytics-integration probing isn't compatible with
// this jest environment; the components barrel pulls it in via ItemCard/ItemCover
// (see docs/PHASE_STATUS.md Phase 3B).
jest.mock('expo-image', () => ({ Image: () => null }));

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

const mockApiClient = {
  categories: { list: jest.fn() },
  items: { list: jest.fn() },
} as unknown as import('@notre-nid/api-client').ApiClient;

jest.mock('../../../../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('../../../../providers/HouseholdProvider', () => ({
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

const PUBLIC_USER = {
  id: 'user-1',
  email: 'alix@example.test',
  displayName: 'Alix',
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const ITEM = {
  id: 'item-1',
  householdId: 'household-1',
  title: 'Dune',
  barcode: null,
  description: null,
  condition: 'GOOD',
  rating: null,
  coverImageUrl: null,
  notes: null,
  customMetadata: null,
  countryCodes: [],
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  category: BOOK_CATEGORY,
  owners: [PUBLIC_USER],
  book: null,
  cd: null,
  dvd: null,
  createdBy: PUBLIC_USER,
  updatedBy: PUBLIC_USER,
};

function page(data: unknown[]) {
  return { data, meta: { page: 1, pageSize: 20, totalItems: data.length, totalPages: 1 } };
}

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider fontsLoaded={false}>
        <CollectionFiltersProvider>
          <CollectionScreen />
        </CollectionFiltersProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('CollectionScreen — empty states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([BOOK_CATEGORY]);
  });

  it('shows the true empty-library wording when the household has no item at all', async () => {
    (mockApiClient.items.list as jest.Mock).mockResolvedValue(page([]));
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('Votre nid est encore vide.')).toBeTruthy());
    expect(view.getByText('Ajoutez votre premier trésor.')).toBeTruthy();
  });

  it('shows a distinct "no results" wording for a text search that matches nothing — never claims the library is empty', async () => {
    (mockApiClient.items.list as jest.Mock).mockImplementation(
      (_householdId: string, params: { search?: string }) =>
        Promise.resolve(page(params.search ? [] : [ITEM])),
    );
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());

    await fireEvent.changeText(view.getByPlaceholderText('Rechercher…'), 'introuvable');

    await waitFor(
      () => expect(view.getByText('Aucun objet ne correspond à votre recherche.')).toBeTruthy(),
      { timeout: 3000 },
    );
    expect(view.getByText('Essayez de modifier votre recherche ou vos filtres.')).toBeTruthy();
    expect(view.queryByText('Votre nid est encore vide.')).toBeNull();
  });

  it('shows the same "no results" wording for a category filter that matches nothing', async () => {
    (mockApiClient.items.list as jest.Mock).mockImplementation(
      (_householdId: string, params: { categoryId?: string }) =>
        Promise.resolve(page(params.categoryId ? [] : [ITEM])),
    );
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    await waitFor(() => expect(view.getByLabelText('Livre')).toBeTruthy());

    await fireEvent.press(view.getByLabelText('Livre'));

    await waitFor(() =>
      expect(view.getByText('Aucun objet ne correspond à votre recherche.')).toBeTruthy(),
    );
    expect(view.getByText('Essayez de modifier votre recherche ou vos filtres.')).toBeTruthy();
    expect(view.queryByText('Votre nid est encore vide.')).toBeNull();
  });
});
