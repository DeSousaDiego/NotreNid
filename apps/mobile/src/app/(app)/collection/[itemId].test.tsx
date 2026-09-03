import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ToastProvider } from '../../../components';
import { ThemeProvider } from '../../../theme';

import ItemDetailScreen from './[itemId]';

// expo-image's module-level analytics-integration probing isn't compatible with
// this jest environment; the components barrel pulls it in via ItemCard even
// though this screen never renders one (see docs/PHASE_STATUS.md Phase 3B).
jest.mock('expo-image', () => ({ Image: () => null }));

// La position basse des FAB dépend de la zone de sécurité de l'appareil (Bloc 4) —
// non pertinente pour ces tests de rendu/interaction, mockée à 0 sur les 4 bords ;
// on ne remplace que `useSafeAreaInsets`, le reste du module (SafeAreaView, utilisé
// par ScreenContainer/BottomSheet/ConfirmDialog/Toast) doit rester réel.
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockApiClient = createMockApiClient();

jest.mock('../../../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('../../../providers/HouseholdProvider', () => ({
  useHousehold: () => ({ householdId: 'household-1' }),
}));

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
  Stack: { Screen: (_props: { options?: { title?: string } }) => null },
  useLocalSearchParams: () => ({ itemId: 'item-1' }),
}));

function createMockApiClient() {
  return {
    items: { get: jest.fn(), archive: jest.fn(), restore: jest.fn() },
  } as unknown as import('@notre-nid/api-client').ApiClient;
}

const ALIX = {
  id: 'user-1',
  email: 'alix@example.com',
  displayName: 'Alix',
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const ELLIE = {
  id: 'user-2',
  email: 'ellie@example.com',
  displayName: 'Ellie',
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const BASE_ITEM = {
  id: 'item-1',
  householdId: 'household-1',
  title: 'Dune',
  description: null,
  condition: 'GOOD' as const,
  rating: null,
  coverImageUrl: null,
  notes: null,
  customMetadata: null,
  countryCodes: [] as string[],
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
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

describe('ItemDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a placeholder instead of a broken layout when there is no cover', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(BASE_ITEM);
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    // Pas de couverture : rien ne doit planter, le titre/les infos restent lisibles.
    expect(view.getByText('Livre')).toBeTruthy();
  });

  it('does not show a rating when the item has none, and shows it when set', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(BASE_ITEM);
    const withoutRating = await renderScreen(<ItemDetailScreen />);
    await waitFor(() => expect(withoutRating.getByText('Dune')).toBeTruthy());
    expect(withoutRating.queryByLabelText(/Note :/)).toBeNull();

    (mockApiClient.items.get as jest.Mock).mockResolvedValue({ ...BASE_ITEM, rating: 4.5 });
    const withRating = await renderScreen(<ItemDetailScreen />);
    await waitFor(() => expect(withRating.getByLabelText('Note : 4.5 sur 5')).toBeTruthy());
  });

  it('only shows the country row when the item has country codes, and lists several', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(BASE_ITEM);
    const withoutCountry = await renderScreen(<ItemDetailScreen />);
    await waitFor(() => expect(withoutCountry.getByText('Dune')).toBeTruthy());
    expect(withoutCountry.queryByText("Pays d'origine")).toBeNull();

    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      countryCodes: ['US', 'FR'],
    });
    const withCountries = await renderScreen(<ItemDetailScreen />);
    await waitFor(() => expect(withCountries.getByText("Pays d'origine")).toBeTruthy());
    expect(withCountries.getByText('États-Unis, France')).toBeTruthy();
  });

  it('shows every owner', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      owners: [ALIX, ELLIE],
    });
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    expect(view.getByLabelText('Propriétaires : Alix, Ellie')).toBeTruthy();
  });

  it('shows the floating edit button for an active item, navigating to the edit screen', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(BASE_ITEM);
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    await fireEvent.press(view.getByLabelText('Modifier cet item'));

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/(app)/collection/edit/[itemId]',
      params: { itemId: 'item-1' },
    });
  });

  it('shows a second FAB to archive an active item, alongside Modifier', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(BASE_ITEM);
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByLabelText('Modifier cet item')).toBeTruthy());
    expect(view.getByLabelText('Archiver cet item')).toBeTruthy();
    expect(view.queryByLabelText('Restaurer cet item')).toBeNull();
  });

  it('hides Modifier/Archiver and shows only Restaurer for an archived item', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      archivedAt: '2026-02-01T00:00:00.000Z',
    });
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    expect(view.queryByLabelText('Modifier cet item')).toBeNull();
    expect(view.queryByLabelText('Archiver cet item')).toBeNull();
    expect(view.getByLabelText('Restaurer cet item')).toBeTruthy();
  });

  it('archives the item from its own FAB after confirmation', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(BASE_ITEM);
    (mockApiClient.items.archive as jest.Mock).mockResolvedValue(undefined);
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByLabelText('Archiver cet item')).toBeTruthy());
    await fireEvent.press(view.getByLabelText('Archiver cet item'));

    await waitFor(() => expect(view.getByText('Archiver cet objet ?')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Archiver' }));

    await waitFor(() =>
      expect(mockApiClient.items.archive).toHaveBeenCalledWith('household-1', 'item-1'),
    );
  });

  it('restores an archived item from its FAB, without a confirmation step (same as before)', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      archivedAt: '2026-02-01T00:00:00.000Z',
    });
    (mockApiClient.items.restore as jest.Mock).mockResolvedValue(undefined);
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByLabelText('Restaurer cet item')).toBeTruthy());
    await fireEvent.press(view.getByLabelText('Restaurer cet item'));

    await waitFor(() =>
      expect(mockApiClient.items.restore).toHaveBeenCalledWith('household-1', 'item-1'),
    );
  });
});
