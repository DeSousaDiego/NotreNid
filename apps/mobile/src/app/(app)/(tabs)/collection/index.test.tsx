import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import {
  CollectionFiltersProvider,
  DEFAULT_COLLECTION_FILTERS,
  useCollectionFilters,
  type CollectionFiltersState,
} from '../../../../providers/CollectionFiltersProvider';
import { ThemeProvider } from '../../../../theme';

import FiltersScreen from '../../collection/filters';
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
  router: { push: (...args: unknown[]) => mockRouterPush(...args), back: jest.fn() },
}));

const mockApiClient = {
  categories: { list: jest.fn() },
  items: { list: jest.fn() },
  households: { listMembers: jest.fn() },
} as unknown as import('@notre-nid/api-client').ApiClient;

/** Simule des filtres déjà appliqués depuis l'écran Filtres (état partagé du provider). */
function PresetFilters({ filters }: { filters: Partial<CollectionFiltersState> }) {
  const { setFilters } = useCollectionFilters();
  // `filters` est créé une seule fois par `renderScreen` et `setFilters` est stable :
  // l'effet ne s'exécute qu'au montage.
  useEffect(() => {
    setFilters({ ...DEFAULT_COLLECTION_FILTERS, ...filters });
  }, [filters, setFilters]);
  return null;
}

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

function renderScreen(presetFilters?: Partial<CollectionFiltersState>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider fontsLoaded={false}>
        <CollectionFiltersProvider>
          {presetFilters ? <PresetFilters filters={presetFilters} /> : null}
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
  (mockApiClient.households.listMembers as jest.Mock).mockResolvedValue([
    { id: 'member-1', role: 'OWNER', joinedAt: '2026-01-01T00:00:00.000Z', user: PUBLIC_USER },
  ]);
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

  it('keeps the loaded items on screen when a pull-to-refresh fails — never swaps them for the error state', async () => {
    listMock()
      .mockResolvedValueOnce(page([ITEM]))
      .mockRejectedValueOnce(new Error('network down'));
    const view = await renderScreen();
    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());

    await fireEvent(view.getByTestId('collection-item-list'), 'refresh');

    await waitFor(() => expect(listMock()).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(view.getByTestId('collection-item-list').props.refreshing).toBe(false),
    );
    expect(view.getByText('Dune')).toBeTruthy();
    expect(view.queryByText("Une erreur inattendue s'est produite.")).toBeNull();
    expect(view.queryByRole('button', { name: 'Réessayer' })).toBeNull();
  });

  it('keeps page 1 on screen when fetching page 2 fails, and lets a later endReached retry it', async () => {
    let page2Attempts = 0;
    listMock().mockImplementation((_householdId: string, params: { page?: number }) => {
      if (params.page === 2) {
        page2Attempts += 1;
        return page2Attempts === 1
          ? Promise.reject(new Error('network down'))
          : Promise.resolve(page([ITEM_2], { page: 2, totalPages: 2 }));
      }
      return Promise.resolve(page([ITEM], { page: 1, totalPages: 2 }));
    });
    const view = await renderScreen();
    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());

    await fireEvent(view.getByTestId('collection-item-list'), 'endReached');
    await waitFor(() => expect(page2Attempts).toBe(1));
    await waitFor(() => expect(view.queryByTestId('collection-pagination-spinner')).toBeNull());

    expect(view.getByText('Dune')).toBeTruthy();
    expect(view.queryByText("Une erreur inattendue s'est produite.")).toBeNull();

    await fireEvent(view.getByTestId('collection-item-list'), 'endReached');
    await waitFor(() => expect(view.getByText('Dune 2')).toBeTruthy());
    expect(page2Attempts).toBe(2);
  });
});

describe('CollectionScreen — empty states', () => {
  /** Liste vide dès qu'une recherche ou un filtre est envoyé ; Dune sinon. */
  function emptyWhenNarrowed() {
    listMock().mockImplementation(
      (
        _householdId: string,
        params: { search?: string; categoryId?: string; ownerId?: string; condition?: string },
      ) =>
        Promise.resolve(
          page(
            params.search || params.categoryId || params.ownerId || params.condition ? [] : [ITEM],
          ),
        ),
    );
  }

  it('shows the shared empty nest with an "Ajouter un objet" CTA when the household has no item at all', async () => {
    listMock().mockResolvedValue(page([]));
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('Votre nid est encore vide.')).toBeTruthy());
    expect(view.getByText('Ajoutez votre premier trésor.')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Ajouter un objet' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/add-item/category');
  });

  it('names the searched term when a text search matches nothing, and offers to clear the search only', async () => {
    emptyWhenNarrowed();
    const view = await renderScreen();
    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());

    await fireEvent.changeText(view.getByPlaceholderText('Rechercher…'), 'introuvable');

    await waitFor(
      () => expect(view.getByText('Aucun objet ne correspond à « introuvable ».')).toBeTruthy(),
      { timeout: 3000 },
    );
    expect(view.getByText('Essayez un autre titre, auteur ou artiste.')).toBeTruthy();
    // Aucun filtre actif : jamais « modifiez vos filtres », jamais « nid vide ».
    expect(view.queryByText(/filtres/)).toBeNull();
    expect(view.queryByText('Votre nid est encore vide.')).toBeNull();

    // Le bouton visible de l'état vide (le champ a aussi sa croix, même libellé).
    await fireEvent.press(view.getByText('Effacer la recherche'));
    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy(), { timeout: 3000 });
    expect(view.getByPlaceholderText('Rechercher…').props.value).toBe('');
  });

  it('shows a filters-specific message for a filter that matches nothing, and "Effacer les filtres" restores the list', async () => {
    emptyWhenNarrowed();
    const view = await renderScreen({ condition: 'POOR', sort: 'title', order: 'asc' });

    await waitFor(() =>
      expect(view.getByText('Aucun objet ne correspond à ces filtres.')).toBeTruthy(),
    );
    expect(view.getByText('Essayez de modifier ou d’effacer certains filtres.')).toBeTruthy();
    expect(view.queryByText('Votre nid est encore vide.')).toBeNull();

    await fireEvent.press(view.getByRole('button', { name: 'Effacer les filtres' }));

    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    // Le tri choisi n'est pas un filtre : il est conservé.
    expect(listMock()).toHaveBeenLastCalledWith(
      'household-1',
      expect.objectContaining({ condition: undefined, sort: 'title', order: 'asc' }),
    );
  });

  it('counts a quick category chip as a filter (no "empty nest" claim)', async () => {
    emptyWhenNarrowed();
    const view = await renderScreen();
    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    await waitFor(() => expect(view.getByLabelText('Livre')).toBeTruthy());

    await fireEvent.press(view.getByLabelText('Livre'));

    await waitFor(() =>
      expect(view.getByText('Aucun objet ne correspond à ces filtres.')).toBeTruthy(),
    );
    expect(view.queryByText('Votre nid est encore vide.')).toBeNull();
  });

  it('with both a search and filters, says so and clears the filters while keeping the search', async () => {
    listMock().mockImplementation(
      (_householdId: string, params: { search?: string; ownerId?: string }) =>
        Promise.resolve(page(params.search && params.ownerId ? [] : [ITEM])),
    );
    const view = await renderScreen({ ownerId: 'user-1' });
    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());

    await fireEvent.changeText(view.getByPlaceholderText('Rechercher…'), 'dune');
    await waitFor(
      () =>
        expect(
          view.getByText('Aucun objet ne correspond à cette recherche et à ces filtres.'),
        ).toBeTruthy(),
      { timeout: 3000 },
    );
    expect(view.queryByText('Effacer la recherche')).toBeNull();

    await fireEvent.press(view.getByRole('button', { name: 'Effacer les filtres' }));

    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    expect(listMock()).toHaveBeenLastCalledWith(
      'household-1',
      expect.objectContaining({ search: 'dune', ownerId: undefined }),
    );
    expect(view.getByPlaceholderText('Rechercher…').props.value).toBe('dune');
  });

  it('keeps pull-to-refresh available on the empty nest — another member may add the first item', async () => {
    listMock()
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(page([ITEM]));
    const view = await renderScreen();
    await waitFor(() => expect(view.getByText('Votre nid est encore vide.')).toBeTruthy());

    await fireEvent(view.getByTestId('collection-item-list'), 'refresh');

    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
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

/**
 * Parcours réel du téléphone : la Collection reste montée sous l'écran Filtres
 * (Stack `(app)`, même `CollectionFiltersProvider`), on choisit un propriétaire et un
 * état, « Appliquer », puis retour à la Collection. `filtersMounted` simule
 * l'ouverture/fermeture de l'écran Filtres (le `router` est mocké).
 */
async function renderCollectionWithFilters() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (filtersMounted: boolean) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider fontsLoaded={false}>
        <CollectionFiltersProvider>
          <CollectionScreen />
          {filtersMounted ? <FiltersScreen /> : null}
        </CollectionFiltersProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
  const view = await render(ui(false));
  return {
    view,
    openFilters: () => view.rerender(ui(true)),
    closeFilters: () => view.rerender(ui(false)),
  };
}

describe('CollectionScreen — end of list', () => {
  const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

  it('constrains the screen content to the visible height (flex: 1), not just flexGrow', async () => {
    listMock().mockResolvedValue(page([ITEM]));
    const view = await renderScreen();
    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());

    // Conteneur commun de l'en-tête et de la liste (vue de contenu de ScreenContainer).
    const container = view.getByTestId('collection-header').parent;
    expect(container).toBeTruthy();
    expect(container?.children).toContain(view.getByTestId('collection-item-list'));
    expect(flat(container?.props.style)).toEqual(expect.objectContaining({ flex: 1 }));
  });

  it('lets the list take only the remaining height and ends it with a simple spacing — no tab bar compensation', async () => {
    listMock().mockResolvedValue(page([ITEM, ITEM_2]));
    const view = await renderScreen();
    await waitFor(() => expect(view.getByText('Dune 2')).toBeTruthy());

    const list = view.getByTestId('collection-item-list');
    expect(flat(list.props.style)).toEqual(expect.objectContaining({ flex: 1 }));
    expect(flat(list.props.contentContainerStyle).paddingBottom).toBe(8);
  });

  it('leaves no layout diagnostic behind', async () => {
    listMock().mockResolvedValue(page([ITEM]));
    const view = await renderScreen();
    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());

    expect(view.queryByTestId('debug-list-footer')).toBeNull();
    expect(view.queryByText(/DEBUG/)).toBeNull();
  });
});

describe('CollectionScreen — filters screen round trip', () => {
  it('keeps the header rows at their own height so the pills below the chips stay visible', async () => {
    listMock().mockResolvedValue(page([ITEM]));
    const view = await renderScreen({ ownerId: 'user-1' });
    await waitFor(() => expect(view.getByTestId('collection-active-filters')).toBeTruthy());

    const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
    expect(flat(view.getByTestId('collection-category-chips').props.style)).toEqual(
      expect.objectContaining({ flexGrow: 0, flexShrink: 0 }),
    );
    expect(flat(view.getByTestId('collection-header').props.style)).toEqual(
      expect.objectContaining({ flexShrink: 0 }),
    );
  });

  it('shows one removable pill per filter applied from the Filters screen, and keeps both in sync', async () => {
    listMock().mockResolvedValue(page([ITEM]));
    const { view, openFilters, closeFilters } = await renderCollectionWithFilters();
    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());

    await openFilters();
    await waitFor(() => expect(view.getByRole('button', { name: 'Alix' })).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Alix' }));
    await fireEvent.press(view.getByRole('button', { name: 'Très bon état' }));
    await fireEvent.press(view.getByRole('button', { name: 'Appliquer les filtres' }));
    await closeFilters();

    await waitFor(() =>
      expect(listMock()).toHaveBeenLastCalledWith(
        'household-1',
        expect.objectContaining({ ownerId: 'user-1', condition: 'VERY_GOOD' }),
      ),
    );
    const ownerPill = { name: 'Retirer le filtre : À Alix' };
    const conditionPill = { name: 'Retirer le filtre : Très bon état' };
    await waitFor(() => expect(view.getByRole('button', ownerPill)).toBeTruthy());
    expect(view.getByRole('button', conditionPill)).toBeTruthy();

    await fireEvent.press(view.getByRole('button', ownerPill));
    await waitFor(() => expect(view.queryByRole('button', ownerPill)).toBeNull());
    expect(view.getByRole('button', conditionPill)).toBeTruthy();
    await waitFor(() =>
      expect(listMock()).toHaveBeenLastCalledWith(
        'household-1',
        expect.objectContaining({ ownerId: undefined, condition: 'VERY_GOOD' }),
      ),
    );

    // Rouvrir Filtres : le brouillon repart de l'état réel (propriétaire « Tout le monde »).
    await openFilters();
    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Tout le monde', selected: true })).toBeTruthy(),
    );
    expect(view.getByRole('button', { name: 'Très bon état', selected: true })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Alix', selected: false })).toBeTruthy();
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

  it('never counts a quick category chip in the filters badge — it is already visible as the selected chip', async () => {
    listMock().mockResolvedValue(page([ITEM]));
    const view = await renderScreen();
    await waitFor(() => expect(view.getByLabelText('Livre')).toBeTruthy());

    await fireEvent.press(view.getByLabelText('Livre'));
    await waitFor(() =>
      expect(listMock()).toHaveBeenCalledWith(
        'household-1',
        expect.objectContaining({ categoryId: 'category-book' }),
      ),
    );
    expect(view.getByLabelText('Filtres')).toBeTruthy();
    expect(view.queryByText('1')).toBeNull();
    expect(view.queryByTestId('collection-active-filters')).toBeNull();
  });

  it('summarizes owner and condition filters as removable pills, counted in the badge', async () => {
    listMock().mockResolvedValue(page([ITEM]));
    const view = await renderScreen({ ownerId: 'user-1', condition: 'VERY_GOOD' });

    const ownerPill = { name: 'Retirer le filtre : À Alix' };
    await waitFor(() => expect(view.getByRole('button', ownerPill)).toBeTruthy());
    expect(view.getByRole('button', { name: 'Retirer le filtre : Très bon état' })).toBeTruthy();
    expect(view.getByLabelText('Filtres (2 actifs)')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', ownerPill));

    await waitFor(() => expect(view.queryByRole('button', ownerPill)).toBeNull());
    expect(view.getByLabelText('Filtres (1 actifs)')).toBeTruthy();
    await waitFor(() =>
      expect(listMock()).toHaveBeenLastCalledWith(
        'household-1',
        expect.objectContaining({ ownerId: undefined, condition: 'VERY_GOOD' }),
      ),
    );
  });

  it('shows a custom category picked in the filters screen as a pill, since no quick chip shows it', async () => {
    const CUSTOM_CATEGORY = {
      ...BOOK_CATEGORY,
      id: 'category-vinyl',
      name: 'Vinyles',
      slug: 'vinyles',
      isSystem: false,
      householdId: 'household-1',
    };
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([
      BOOK_CATEGORY,
      CUSTOM_CATEGORY,
    ]);
    listMock().mockResolvedValue(page([ITEM]));
    const view = await renderScreen({ categoryId: 'category-vinyl' });

    await waitFor(() => expect(view.getByText('Vinyles')).toBeTruthy());
    expect(view.getByLabelText('Filtres (1 actifs)')).toBeTruthy();
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
