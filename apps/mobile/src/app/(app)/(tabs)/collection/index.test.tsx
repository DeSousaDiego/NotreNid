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

const ITEM_2 = { ...ITEM, id: 'item-2', title: 'Dune 2' };

function page(data: unknown[], meta?: Partial<{ page: number; totalPages: number }>) {
  return {
    data,
    meta: {
      page: meta?.page ?? 1,
      pageSize: 20,
      totalItems: data.length,
      totalPages: meta?.totalPages ?? 1,
    },
  };
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

type ListMock = jest.Mock;
function listMock(): ListMock {
  return mockApiClient.items.list as jest.Mock;
}

beforeEach(() => {
  jest.clearAllMocks();
  (mockApiClient.categories.list as jest.Mock).mockResolvedValue([BOOK_CATEGORY]);
});

describe('CollectionScreen — loading and error states', () => {
  it('shows the loading skeleton, never the empty state, while the first page is in flight', async () => {
    let resolveFirstPage!: (value: unknown) => void;
    listMock().mockReturnValue(
      new Promise((resolve) => {
        resolveFirstPage = resolve;
      }),
    );
    const view = await renderScreen();

    expect(view.getByTestId('collection-loading-skeleton')).toBeTruthy();
    expect(view.queryByText('Votre nid est encore vide.')).toBeNull();

    resolveFirstPage(page([ITEM]));
    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    expect(view.queryByTestId('collection-loading-skeleton')).toBeNull();
  });

  it('shows an error state on API failure and refetches on retry', async () => {
    listMock().mockRejectedValueOnce(new Error('network down'));
    const view = await renderScreen();

    await waitFor(() =>
      expect(view.getByText("Une erreur inattendue s'est produite.")).toBeTruthy(),
    );

    listMock().mockResolvedValueOnce(page([ITEM]));
    await fireEvent.press(view.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    expect(listMock()).toHaveBeenCalledTimes(2);
  });
});

describe('CollectionScreen — empty states', () => {
  it('shows the true empty-library wording when the household has no item at all', async () => {
    listMock().mockResolvedValue(page([]));
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('Votre nid est encore vide.')).toBeTruthy());
    expect(view.getByText('Ajoutez votre premier trésor.')).toBeTruthy();
  });

  it('shows a distinct "no results" wording for a text search that matches nothing — never claims the library is empty', async () => {
    listMock().mockImplementation((_householdId: string, params: { search?: string }) =>
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
    listMock().mockImplementation((_householdId: string, params: { categoryId?: string }) =>
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

describe('CollectionScreen — search', () => {
  // Le débounce lui-même (délai exact, annulation d'un délai précédent) est déjà
  // couvert précisément par de vrais fake timers dans `useDebouncedValue.test.ts` —
  // ici on ne vérifie que le câblage de bout en bout (la frappe finit par produire
  // le bon `search`), avec une marge large plutôt que des timers falsifiés : le
  // débounce (300 ms) est ré-exporté par React Query lui-même via son propre
  // `setTimeout` de notification par lot, et combiner de faux timers avec React
  // Query s'est avéré source de blocages difficiles à diagnostiquer sans bénéfice
  // réel ici (le mécanisme de délai est déjà prouvé ailleurs).
  it('eventually sends the typed text as `search`, not on every keystroke', async () => {
    listMock().mockResolvedValue(page([ITEM]));
    const view = await renderScreen();
    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    listMock().mockClear();

    await fireEvent.changeText(view.getByPlaceholderText('Rechercher…'), 'dune');

    await waitFor(
      () =>
        expect(listMock()).toHaveBeenCalledWith(
          'household-1',
          expect.objectContaining({ search: 'dune' }),
        ),
      { timeout: 3000 },
    );
    // Un seul appel réseau pour la recherche complète, pas un par caractère tapé.
    expect(listMock()).toHaveBeenCalledTimes(1);
  });
});

describe('CollectionScreen — filters', () => {
  it('sends the selected category as `categoryId`', async () => {
    listMock().mockResolvedValue(page([ITEM]));
    const view = await renderScreen();
    await waitFor(() => expect(view.getByLabelText('Livre')).toBeTruthy());
    listMock().mockClear();

    await fireEvent.press(view.getByLabelText('Livre'));

    await waitFor(() =>
      expect(listMock()).toHaveBeenCalledWith(
        'household-1',
        expect.objectContaining({ categoryId: 'category-book' }),
      ),
    );
  });

  it('combines an active search with an active category filter in the same request', async () => {
    listMock().mockResolvedValue(page([ITEM]));
    const view = await renderScreen();
    await waitFor(() => expect(view.getByLabelText('Livre')).toBeTruthy());

    await fireEvent.press(view.getByLabelText('Livre'));
    await fireEvent.changeText(view.getByPlaceholderText('Rechercher…'), 'dune');

    await waitFor(
      () =>
        expect(listMock()).toHaveBeenCalledWith(
          'household-1',
          expect.objectContaining({ categoryId: 'category-book', search: 'dune' }),
        ),
      { timeout: 3000 },
    );
  });

  it('reflects the active filter count as a visible badge on the filters button, and clears it back to none via "Toutes"', async () => {
    listMock().mockResolvedValue(page([ITEM]));
    const view = await renderScreen();
    await waitFor(() => expect(view.getByLabelText('Livre')).toBeTruthy());

    expect(view.queryByText('1')).toBeNull();

    await fireEvent.press(view.getByLabelText('Livre'));
    await waitFor(() => expect(view.getByText('1')).toBeTruthy());
    expect(view.getByLabelText('Filtres (1 actifs)')).toBeTruthy();

    await fireEvent.press(view.getByLabelText('Toutes'));
    await waitFor(() => expect(view.queryByText('1')).toBeNull());
    expect(view.getByLabelText('Filtres')).toBeTruthy();
  });
});

describe('CollectionScreen — pagination', () => {
  it('fetches page 2 on endReached when a next page exists', async () => {
    listMock().mockImplementation((_householdId: string, params: { page?: number }) =>
      Promise.resolve(
        params.page === 2
          ? page([ITEM_2], { page: 2, totalPages: 2 })
          : page([ITEM], { page: 1, totalPages: 2 }),
      ),
    );
    const view = await renderScreen();
    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    expect(view.queryByText('Dune 2')).toBeNull();

    await fireEvent(view.getByTestId('collection-item-list'), 'endReached');

    await waitFor(() => expect(view.getByText('Dune 2')).toBeTruthy());
  });

  it('shows the footer spinner while page 2 is in flight, and hides it once it resolves', async () => {
    let resolvePage2!: (value: unknown) => void;
    listMock().mockImplementation((_householdId: string, params: { page?: number }) => {
      if (params.page === 2) {
        return new Promise((resolve) => {
          resolvePage2 = resolve;
        });
      }
      return Promise.resolve(page([ITEM], { page: 1, totalPages: 2 }));
    });
    const view = await renderScreen();
    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    expect(view.queryByTestId('collection-pagination-spinner')).toBeNull();

    await fireEvent(view.getByTestId('collection-item-list'), 'endReached');
    await waitFor(() => expect(view.getByTestId('collection-pagination-spinner')).toBeTruthy());

    resolvePage2(page([ITEM_2], { page: 2, totalPages: 2 }));
    await waitFor(() => expect(view.getByText('Dune 2')).toBeTruthy());
    expect(view.queryByTestId('collection-pagination-spinner')).toBeNull();
  });

  it('never fetches page 2 twice for a rapid double endReached while the first fetch is still pending', async () => {
    let resolvePage2!: (value: unknown) => void;
    listMock().mockImplementation((_householdId: string, params: { page?: number }) => {
      if (params.page === 2) {
        return new Promise((resolve) => {
          resolvePage2 = resolve;
        });
      }
      return Promise.resolve(page([ITEM], { page: 1, totalPages: 2 }));
    });
    const view = await renderScreen();
    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());

    const list = view.getByTestId('collection-item-list');
    await fireEvent(list, 'endReached');
    await fireEvent(list, 'endReached');

    const page2Calls = listMock().mock.calls.filter(
      (call) => (call[1] as { page?: number })?.page === 2,
    );
    expect(page2Calls).toHaveLength(1);

    resolvePage2(page([ITEM_2], { page: 2, totalPages: 2 }));
    await waitFor(() => expect(view.getByText('Dune 2')).toBeTruthy());
  });

  it('does not fetch a further page once the end of the list is reached', async () => {
    listMock().mockResolvedValue(page([ITEM], { page: 1, totalPages: 1 }));
    const view = await renderScreen();
    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    listMock().mockClear();

    await fireEvent(view.getByTestId('collection-item-list'), 'endReached');

    // Pas de nouvel appel : `hasNextPage` est déjà `false` (une seule page au total).
    expect(listMock()).not.toHaveBeenCalled();
    expect(view.queryByTestId('collection-pagination-spinner')).toBeNull();
  });
});

describe('CollectionScreen — pull to refresh', () => {
  it('triggers a refetch, and never shows the initial skeleton while it is in flight', async () => {
    let callCount = 0;
    let resolveRefetch!: (value: unknown) => void;
    listMock().mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) return Promise.resolve(page([ITEM]));
      return new Promise((resolve) => {
        resolveRefetch = resolve;
      });
    });
    const view = await renderScreen();
    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());

    const list = view.getByTestId('collection-item-list');
    expect(list.props.refreshing).toBe(false);

    await fireEvent(list, 'refresh');

    await waitFor(() =>
      expect(view.getByTestId('collection-item-list').props.refreshing).toBe(true),
    );
    // Toujours la liste, jamais le squelette de premier chargement, pendant un refresh.
    expect(view.getByText('Dune')).toBeTruthy();
    expect(view.queryByTestId('collection-loading-skeleton')).toBeNull();

    resolveRefetch(page([ITEM]));
    await waitFor(() =>
      expect(view.getByTestId('collection-item-list').props.refreshing).toBe(false),
    );
    expect(callCount).toBe(2);
  });
});
