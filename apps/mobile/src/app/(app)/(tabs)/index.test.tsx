import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ToastProvider } from '../../../components';
import { ThemeProvider } from '../../../theme';

import HomeScreen from './index';

// expo-image's module-level analytics-integration probing isn't compatible with
// this jest environment; the components barrel pulls it in via ItemCard even
// though this screen never renders one directly (see docs/PHASE_STATUS.md Phase 3B).
jest.mock('expo-image', () => ({ Image: () => null }));

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
  useHousehold: () => ({ householdId: 'household-1' }),
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
  totalActiveItems: 3,
  archivedCount: 0,
  countByCategory: [],
  countByOwner: [],
  recentAdditions: [],
};

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

function itemsPage(data: (typeof DUNE)[]) {
  return { data, meta: { page: 1, pageSize: 5, totalItems: data.length, totalPages: 1 } };
}

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

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockApiClient.stats.get as jest.Mock).mockResolvedValue(STATS);
  });

  it('shows an empty state instead of a blank section when there are no items yet', async () => {
    (mockApiClient.items.list as jest.Mock).mockResolvedValue(itemsPage([]));
    const view = await renderScreen(<HomeScreen />);

    await waitFor(() => expect(view.getByText('Votre nid est encore vide.')).toBeTruthy());
  });

  it('shows the cover, title, author and "Ajouté par" for a recent item, without image', async () => {
    (mockApiClient.items.list as jest.Mock).mockResolvedValue(itemsPage([DUNE]));
    const view = await renderScreen(<HomeScreen />);

    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    expect(view.getByText('Frank Herbert')).toBeTruthy();
    expect(view.getByText(/Ajouté par Alix/)).toBeTruthy();
  });

  it('renders an item with no cover without crashing (icon fallback)', async () => {
    (mockApiClient.items.list as jest.Mock).mockResolvedValue(
      itemsPage([{ ...DUNE, coverImageUrl: null }]),
    );
    const view = await renderScreen(<HomeScreen />);

    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
  });

  it('navigates to the item detail screen when a recent item is pressed', async () => {
    (mockApiClient.items.list as jest.Mock).mockResolvedValue(itemsPage([DUNE]));
    const view = await renderScreen(<HomeScreen />);

    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    await fireEvent.press(view.getByLabelText('Dune, Livre'));

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/(app)/collection/[itemId]',
      params: { itemId: 'item-1' },
    });
  });

  it('requests the 5 most recently created, non-archived items', async () => {
    (mockApiClient.items.list as jest.Mock).mockResolvedValue(itemsPage([DUNE]));
    await renderScreen(<HomeScreen />);

    await waitFor(() =>
      expect(mockApiClient.items.list).toHaveBeenCalledWith(
        'household-1',
        expect.objectContaining({
          sort: 'createdAt',
          order: 'desc',
          pageSize: 5,
          archived: false,
        }),
      ),
    );
  });
});
