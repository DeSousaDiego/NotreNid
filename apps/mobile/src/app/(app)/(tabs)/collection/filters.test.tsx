import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '../../../../theme';
import {
  CollectionFiltersProvider,
  useCollectionFilters,
} from '../../../../providers/CollectionFiltersProvider';

import FiltersScreen from './filters';

// expo-image's module-level analytics-integration probing isn't compatible with
// this jest environment; the components barrel pulls it in via ItemCard even
// though this screen never renders one (see docs/PHASE_STATUS.md Phase 3B).
jest.mock('expo-image', () => ({ Image: () => null }));

// The fixed footer (docs/PHASE_STATUS.md) needs a real `useSafeAreaInsets`; this
// test doesn't render a `SafeAreaProvider` — only `useSafeAreaInsets` is mocked,
// the rest of the module (`SafeAreaView`, used by `ScreenContainer`) stays real.
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockApiClient = createMockApiClient();

jest.mock('../../../../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
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

const mockRouterBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { back: (...args: unknown[]) => mockRouterBack(...args) },
}));

function createMockApiClient() {
  return {
    categories: { list: jest.fn() },
    households: { listMembers: jest.fn() },
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

/** Lit le filtre partagé courant sans passer par l'UI, pour vérifier ce qui a été commité. */
function FiltersProbe({ onRead }: { onRead: (categoryId: string | undefined) => void }) {
  const { filters } = useCollectionFilters();
  onRead(filters.categoryId);
  return null;
}

function renderScreen(onFiltersRead: (categoryId: string | undefined) => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider fontsLoaded={false}>
        <CollectionFiltersProvider>
          <FiltersProbe onRead={onFiltersRead} />
          <FiltersScreen />
        </CollectionFiltersProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('FiltersScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([BOOK_CATEGORY]);
    (mockApiClient.households.listMembers as jest.Mock).mockResolvedValue([MEMBER]);
  });

  it('does not commit a selection to the shared filters until "Appliquer" is pressed', async () => {
    let lastRead: string | undefined = 'not-set-yet';
    const view = await renderScreen((categoryId) => {
      lastRead = categoryId;
    });

    await waitFor(() => expect(view.getByLabelText('Livre')).toBeTruthy());
    await fireEvent.press(view.getByLabelText('Livre'));

    // Le brouillon change visuellement...
    expect(view.getByLabelText('Livre').props.accessibilityState.selected).toBe(true);
    // ...mais le filtre partagé (lu par un consommateur indépendant) n'a pas encore bougé.
    expect(lastRead).toBeUndefined();
  });

  it('commits the draft and navigates back when "Appliquer les filtres" is pressed', async () => {
    const view = await renderScreen(() => {});

    await waitFor(() => expect(view.getByLabelText('Livre')).toBeTruthy());
    await fireEvent.press(view.getByLabelText('Livre'));
    await fireEvent.press(view.getByRole('button', { name: 'Appliquer les filtres' }));

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  it('"Réinitialiser" clears the draft back to no active filter', async () => {
    const view = await renderScreen(() => {});

    await waitFor(() => expect(view.getByLabelText('Livre')).toBeTruthy());
    await fireEvent.press(view.getByLabelText('Livre'));
    expect(view.getByLabelText('Livre').props.accessibilityState.selected).toBe(true);

    await fireEvent.press(view.getByText('Réinitialiser'));

    expect(view.getByLabelText('Livre').props.accessibilityState.selected).toBe(false);
    expect(view.getByLabelText('Toutes').props.accessibilityState.selected).toBe(true);
  });
});
