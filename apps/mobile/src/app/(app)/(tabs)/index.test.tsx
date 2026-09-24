import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ToastProvider } from '../../../components';
import { queryKeys } from '../../../lib/queryKeys';
import { ThemeProvider } from '../../../theme';

import HomeScreen from './index';

// expo-image's module-level analytics-integration probing isn't compatible with
// this jest environment; the components barrel pulls it in via ItemCard even
// though this screen never renders one directly (see docs/PHASE_STATUS.md Phase 3B).
jest.mock('expo-image', () => ({ Image: () => null }));

// `useTabBarClearance` (Bloc 4) a besoin d'un `useSafeAreaInsets` réel ; ce test ne
// rend pas de `SafeAreaProvider` — seul `useSafeAreaInsets` est mocké, le reste du
// module (SafeAreaView, utilisé par ScreenContainer/Toast) doit rester réel.
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

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

jest.mock('../../../providers/HouseholdProvider', () => ({
  useHousehold: () => ({
    householdId: 'household-1',
    households: [
      { id: 'household-2', name: 'Autre foyer', role: 'MEMBER' },
      { id: 'household-1', name: 'Chez Alix & Sam', role: 'OWNER' },
    ],
  }),
}));

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

function createMockApiClient() {
  return {
    stats: { get: jest.fn() },
    items: { list: jest.fn() },
  } as unknown as import('@notre-nid/api-client').ApiClient;
}

const STATS = {
  totalActiveItems: 12,
  archivedCount: 0,
  countByCategory: [
    { categoryId: 'cat-book', categoryName: 'Livre', categorySlug: 'book', count: 7 },
    { categoryId: 'cat-cd', categoryName: 'CD', categorySlug: 'cd', count: 4 },
    { categoryId: 'cat-dvd', categoryName: 'DVD', categorySlug: 'dvd', count: 1 },
  ],
  countByOwner: [],
  recentAdditions: [],
};

const EMPTY_STATS = { ...STATS, totalActiveItems: 0, countByCategory: [] };

const ALIX = {
  id: 'user-1',
  email: 'alix@example.com',
  displayName: 'Alix',
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const DUNE = {
  id: 'item-1',
  householdId: 'household-1',
  title: 'Dune',
  barcode: null,
  description: null,
  condition: 'GOOD' as const,
  rating: null,
  coverImageUrl: 'https://cdn.test/dune.jpg' as string | null,
  notes: null,
  customMetadata: null,
  countryCodes: [] as string[],
  archivedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  category: {
    id: 'cat-book',
    householdId: null,
    name: 'Livre',
    slug: 'book',
    icon: null,
    isSystem: true,
    metadataSchema: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  owners: [ALIX],
  book: {
    itemId: 'item-1',
    author: 'Frank Herbert',
    isbn: null,
    publisher: null,
    publicationYear: null,
    language: null,
    pageCount: null,
  },
  cd: null,
  dvd: null,
  createdBy: ALIX,
  updatedBy: ALIX,
};

/** Mêmes filtres que l'écran — sert à pré-remplir le cache des récents. */
const RECENT_FILTERS = {
  sort: 'createdAt',
  order: 'desc',
  pageSize: 5,
  archived: false,
} as const;

function itemsPage(data: (typeof DUNE)[]) {
  return { data, meta: { page: 1, pageSize: 5, totalItems: data.length, totalPages: 1 } };
}

function never<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

function renderScreen(ui: ReactElement, queryClient = createQueryClient()) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider fontsLoaded={false}>
        <ToastProvider>{ui}</ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return Object.assign(view, { queryClient });
}

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockApiClient.stats.get as jest.Mock).mockResolvedValue(STATS);
    (mockApiClient.items.list as jest.Mock).mockResolvedValue(itemsPage([DUNE]));
  });

  describe('header', () => {
    it('shows "Notre Nid" as a header, the current household name and the welcome message', async () => {
      const view = await renderScreen(<HomeScreen />);

      expect(view.getByRole('header', { name: 'Notre Nid' })).toBeTruthy();
      expect(view.getByText('Chez Alix & Sam')).toBeTruthy();
      expect(view.getByLabelText('Foyer : Chez Alix & Sam')).toBeTruthy();
      expect(view.queryByText('Autre foyer')).toBeNull();
      expect(view.getByText('Bienvenue dans votre nid, Alix.')).toBeTruthy();
    });
  });

  describe('loading', () => {
    it('shows stats and recent-item skeletons while both queries are pending', async () => {
      (mockApiClient.stats.get as jest.Mock).mockReturnValue(never());
      (mockApiClient.items.list as jest.Mock).mockReturnValue(never());
      const view = await renderScreen(<HomeScreen />);

      expect(view.getByTestId('home-stats-skeleton')).toBeTruthy();
      expect(view.getByTestId('home-recent-skeleton')).toBeTruthy();
      // Pas de bouton « Voir la collection » tant qu'on ignore si le nid est vide.
      expect(view.queryByText('Voir la collection')).toBeNull();
    });
  });

  describe('stats', () => {
    it('renders the total as a sentence and one tile per category, each read as a unit', async () => {
      const view = await renderScreen(<HomeScreen />);

      await waitFor(() => expect(view.getByText('12 trésors dans votre nid')).toBeTruthy());
      expect(view.getByRole('header', { name: '12 trésors dans votre nid' })).toBeTruthy();
      expect(view.getByLabelText('7 livres')).toBeTruthy();
      expect(view.getByLabelText('4 CD')).toBeTruthy();
      // 0 et 1 au singulier.
      expect(view.getByLabelText('1 DVD')).toBeTruthy();
      expect(view.queryByTestId('home-stats-skeleton')).toBeNull();
    });

    it('uses the singular for a single treasure', async () => {
      (mockApiClient.stats.get as jest.Mock).mockResolvedValue({
        ...STATS,
        totalActiveItems: 1,
        countByCategory: [STATS.countByCategory[0]!, { ...STATS.countByCategory[0]!, count: 1 }],
      });
      const view = await renderScreen(<HomeScreen />);

      await waitFor(() => expect(view.getByText('1 trésor dans votre nid')).toBeTruthy());
    });

    it('shows a full error state with retry when stats fail and nothing is cached', async () => {
      (mockApiClient.stats.get as jest.Mock).mockRejectedValue(new Error('boom'));
      const view = await renderScreen(<HomeScreen />);

      await waitFor(() => expect(view.getByText('Un problème est survenu')).toBeTruthy());
      (mockApiClient.stats.get as jest.Mock).mockResolvedValue(STATS);
      await fireEvent.press(view.getByText('Réessayer'));

      await waitFor(() => expect(view.getByText('12 trésors dans votre nid')).toBeTruthy());
    });

    it('keeps cached stats on screen when a refetch fails', async () => {
      const queryClient = createQueryClient();
      queryClient.setQueryData(queryKeys.stats('user-1', 'household-1'), STATS);
      (mockApiClient.stats.get as jest.Mock).mockRejectedValue(new Error('offline'));
      const view = await renderScreen(<HomeScreen />, queryClient);

      // Donnée pré-remplie considérée périmée (staleTime 0) → refetch au montage, en échec.
      await waitFor(() =>
        expect(queryClient.getQueryState(queryKeys.stats('user-1', 'household-1'))?.status).toBe(
          'error',
        ),
      );
      expect(view.getByText('12 trésors dans votre nid')).toBeTruthy();
      expect(view.queryByText('Un problème est survenu')).toBeNull();
    });
  });

  describe('recent items', () => {
    it('shows the title, author and "Ajouté par" for a recent item, under an "Ajouts récents" header', async () => {
      const view = await renderScreen(<HomeScreen />);

      await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
      expect(view.getByRole('header', { name: 'Ajouts récents' })).toBeTruthy();
      expect(view.getByText('Frank Herbert')).toBeTruthy();
      expect(view.getByText(/Ajouté par Alix/)).toBeTruthy();
      expect(view.queryByTestId('home-recent-skeleton')).toBeNull();
    });

    it('requests the 5 most recently created, non-archived items', async () => {
      await renderScreen(<HomeScreen />);

      await waitFor(() =>
        expect(mockApiClient.items.list).toHaveBeenCalledWith(
          'household-1',
          expect.objectContaining(RECENT_FILTERS),
        ),
      );
    });

    it('navigates to the item detail screen when a recent item is pressed', async () => {
      const view = await renderScreen(<HomeScreen />);

      await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
      await fireEvent.press(view.getByLabelText(/^Dune, Livre, Frank Herbert/));

      expect(mockRouterPush).toHaveBeenCalledWith({
        pathname: '/(app)/collection/[itemId]',
        params: { itemId: 'item-1' },
      });
    });

    it('still shows recent items while stats are loading', async () => {
      (mockApiClient.stats.get as jest.Mock).mockReturnValue(never());
      const view = await renderScreen(<HomeScreen />);

      await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
      expect(view.getByTestId('home-stats-skeleton')).toBeTruthy();
    });

    it('still shows recent items when stats fail', async () => {
      (mockApiClient.stats.get as jest.Mock).mockRejectedValue(new Error('boom'));
      const view = await renderScreen(<HomeScreen />);

      await waitFor(() => expect(view.getByText('Un problème est survenu')).toBeTruthy());
      await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    });

    it('shows a dedicated error state with retry when recent items fail', async () => {
      (mockApiClient.items.list as jest.Mock).mockRejectedValue(new Error('boom'));
      const view = await renderScreen(<HomeScreen />);

      await waitFor(() =>
        expect(view.getByText('Impossible d’afficher les ajouts récents')).toBeTruthy(),
      );
      // Les stats, elles, restent affichées.
      expect(view.getByText('12 trésors dans votre nid')).toBeTruthy();

      (mockApiClient.items.list as jest.Mock).mockResolvedValue(itemsPage([DUNE]));
      await fireEvent.press(view.getByText('Réessayer'));
      await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    });

    it('keeps cached recent items on screen when a refetch fails', async () => {
      const queryClient = createQueryClient();
      const key = queryKeys.items('user-1', 'household-1', RECENT_FILTERS);
      queryClient.setQueryData(key, { pages: [itemsPage([DUNE])], pageParams: [1] });
      (mockApiClient.items.list as jest.Mock).mockRejectedValue(new Error('offline'));
      const view = await renderScreen(<HomeScreen />, queryClient);

      await waitFor(() => expect(queryClient.getQueryState(key)?.status).toBe('error'));
      expect(view.getByText('Dune')).toBeTruthy();
      expect(view.queryByText('Impossible d’afficher les ajouts récents')).toBeNull();
    });

    it('hides the whole section rather than showing an empty block when no item is returned', async () => {
      (mockApiClient.items.list as jest.Mock).mockResolvedValue(itemsPage([]));
      const view = await renderScreen(<HomeScreen />);

      await waitFor(() => expect(view.getByText('12 trésors dans votre nid')).toBeTruthy());
      await waitFor(() => expect(mockApiClient.items.list).toHaveBeenCalled());
      expect(view.queryByText('Ajouts récents')).toBeNull();
    });
  });

  describe('empty nest', () => {
    beforeEach(() => {
      (mockApiClient.stats.get as jest.Mock).mockResolvedValue(EMPTY_STATS);
      (mockApiClient.items.list as jest.Mock).mockResolvedValue(itemsPage([]));
    });

    it('shows a warm empty state instead of tiles at zero, recent items or the collection button', async () => {
      const view = await renderScreen(<HomeScreen />);

      await waitFor(() => expect(view.getByText('Votre nid est encore vide.')).toBeTruthy());
      expect(view.getByText('Ajoutez votre premier trésor.')).toBeTruthy();
      expect(view.queryByLabelText('0 livre')).toBeNull();
      expect(view.queryByText(/dans votre nid$/)).toBeNull();
      expect(view.queryByText('Ajouts récents')).toBeNull();
      expect(view.queryByText('Voir la collection')).toBeNull();
    });

    it('opens the add flow from the "Ajouter un objet" CTA', async () => {
      const view = await renderScreen(<HomeScreen />);

      await waitFor(() => expect(view.getByText('Ajouter un objet')).toBeTruthy());
      await fireEvent.press(view.getByText('Ajouter un objet'));

      expect(mockRouterPush).toHaveBeenCalledWith('/(app)/add-item/category');
    });
  });

  describe('collection button', () => {
    it('shows "Voir la collection" and navigates to the collection tab', async () => {
      const view = await renderScreen(<HomeScreen />);

      await waitFor(() => expect(view.getByText('Voir la collection')).toBeTruthy());
      await fireEvent.press(view.getByText('Voir la collection'));

      expect(mockRouterPush).toHaveBeenCalledWith('/collection');
    });
  });

  describe('pull-to-refresh', () => {
    it('refetches both stats and recent items', async () => {
      const view = await renderScreen(<HomeScreen />);
      await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
      expect(mockApiClient.stats.get).toHaveBeenCalledTimes(1);
      expect(mockApiClient.items.list).toHaveBeenCalledTimes(1);

      const { refreshControl } = view.getByTestId('home-scroll').props as {
        refreshControl: ReactElement<{ onRefresh: () => void }>;
      };
      await act(async () => {
        refreshControl.props.onRefresh();
      });

      await waitFor(() => expect(mockApiClient.stats.get).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(mockApiClient.items.list).toHaveBeenCalledTimes(2));
    });
  });
});
