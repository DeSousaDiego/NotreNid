import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { COLLECTION_SORT_PRESETS } from '../../../constants/collectionSort';
import {
  CollectionFiltersProvider,
  useCollectionFilters,
  type CollectionFiltersState,
} from '../../../providers/CollectionFiltersProvider';
import { ThemeProvider } from '../../../theme';

import FiltersScreen from './filters';

// expo-image's module-level analytics-integration probing isn't compatible with
// this jest environment; the components barrel pulls it in via ItemCard even
// though this screen never renders one (see docs/PHASE_STATUS.md Phase 3B).
jest.mock('expo-image', () => ({ Image: () => null }));

// Une vraie zone système basse : hors des onglets, aucune tab bar ne la réserve — le
// footer l'ajoute lui-même, une seule fois (voir « bottom spacing »). Seul
// `useSafeAreaInsets` est mocké ; `SafeAreaView` (utilisée par `ScreenContainer`) reste réelle.
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
}));

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

const flatStyle = (style: unknown) =>
  Object.assign({}, ...[style].flat(Infinity).filter(Boolean)) as Record<string, unknown>;

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
function FiltersProbe({ onRead }: { onRead: (filters: CollectionFiltersState) => void }) {
  const { filters } = useCollectionFilters();
  onRead(filters);
  return null;
}

function renderScreen(onFiltersRead: (filters: CollectionFiltersState) => void) {
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
    const view = await renderScreen((filters) => {
      lastRead = filters.categoryId;
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

  it('"Réinitialiser" clears the draft back to no active filter, and is inactive when there is nothing to reset', async () => {
    const view = await renderScreen(() => {});
    const reset = () => view.getByRole('button', { name: 'Réinitialiser' });

    await waitFor(() => expect(view.getByLabelText('Livre')).toBeTruthy());
    expect(reset().props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(view.getByLabelText('Livre'));
    await fireEvent.press(view.getByRole('button', { name: 'Titre A → Z' }));
    expect(view.getByLabelText('Livre').props.accessibilityState.selected).toBe(true);
    expect(reset().props.accessibilityState.disabled).toBe(false);

    await fireEvent.press(reset());

    expect(view.getByLabelText('Livre').props.accessibilityState.selected).toBe(false);
    expect(view.getByLabelText('Toutes').props.accessibilityState.selected).toBe(true);
    expect(view.getByRole('button', { name: 'Plus récents', selected: true })).toBeTruthy();
    expect(reset().props.accessibilityState.disabled).toBe(true);
  });

  it('keeps "Réinitialiser" a secondary 44 pt action in the footer, beside the main "Appliquer" button', async () => {
    const view = await renderScreen(() => {});
    await waitFor(() => expect(view.getByLabelText('Livre')).toBeTruthy());

    const footer = view.getByTestId('filters-footer');
    expect(footer).toContainElement(view.getByRole('button', { name: 'Réinitialiser' }));
    expect(footer).toContainElement(view.getByRole('button', { name: 'Appliquer les filtres' }));
    const reset = view.getByRole('button', { name: 'Réinitialiser' });
    expect(flatStyle(reset.props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  describe('sort', () => {
    it('offers plain-language sorts — no "Ordre", "Croissant" or "Décroissant"', async () => {
      const view = await renderScreen(() => {});
      await waitFor(() => expect(view.getByLabelText('Livre')).toBeTruthy());

      for (const label of [
        'Plus récents',
        'Plus anciens',
        'Titre A → Z',
        'Titre Z → A',
        'Récemment modifiés',
        'Meilleur état d’abord',
      ]) {
        expect(view.getByRole('button', { name: label })).toBeTruthy();
      }
      expect(view.queryByText('Ordre')).toBeNull();
      expect(view.queryByText('Croissant')).toBeNull();
      expect(view.queryByText('Décroissant')).toBeNull();
      // Valeur par défaut (createdAt/desc) = « Plus récents ».
      expect(view.getByRole('button', { name: 'Plus récents', selected: true })).toBeTruthy();
    });

    it('maps each label to an existing API sort/order pair', () => {
      expect(
        Object.fromEntries(COLLECTION_SORT_PRESETS.map((p) => [p.label, `${p.sort}:${p.order}`])),
      ).toEqual({
        'Plus récents': 'createdAt:desc',
        'Plus anciens': 'createdAt:asc',
        'Titre A → Z': 'title:asc',
        'Titre Z → A': 'title:desc',
        'Récemment modifiés': 'updatedAt:desc',
        'Meilleur état d’abord': 'condition:asc',
      });
    });

    it('commits the chosen sort as the matching sort/order pair on "Appliquer"', async () => {
      let lastRead: CollectionFiltersState | undefined;
      const view = await renderScreen((filters) => {
        lastRead = filters;
      });
      await waitFor(() => expect(view.getByLabelText('Livre')).toBeTruthy());

      await fireEvent.press(view.getByRole('button', { name: 'Titre Z → A' }));
      expect(view.getByRole('button', { name: 'Titre Z → A', selected: true })).toBeTruthy();
      expect(view.queryByRole('button', { name: 'Plus récents', selected: true })).toBeNull();
      await fireEvent.press(view.getByRole('button', { name: 'Appliquer les filtres' }));

      expect(lastRead).toEqual(expect.objectContaining({ sort: 'title', order: 'desc' }));
    });
  });

  it('uses the light form section titles as headings', async () => {
    const view = await renderScreen(() => {});
    await waitFor(() => expect(view.getByLabelText('Livre')).toBeTruthy());

    for (const title of ['Catégorie', 'Appartient à', 'État', 'Trier par']) {
      expect(view.getByRole('header', { name: title })).toBeTruthy();
    }
  });

  it('gives every chip a 44 pt touch target, with rows spaced so touch areas never overlap', async () => {
    const view = await renderScreen(() => {});
    await waitFor(() => expect(view.getByLabelText('Alix')).toBeTruthy());

    for (const label of ['Toutes', 'Livre', 'Tout le monde', 'Alix', 'Bon état', 'Plus anciens']) {
      const chip = view.getByRole('button', { name: label });
      const height = flatStyle(chip.props.style).minHeight as number;
      const { top, bottom } = chip.props.hitSlop as { top: number; bottom: number };
      expect(height + top + bottom).toBeGreaterThanOrEqual(44);
      expect(flatStyle(chip.parent?.props.style).rowGap).toBeGreaterThanOrEqual(top + bottom);
    }
  });

  describe('bottom spacing', () => {
    type Node = { props: Record<string, unknown>; children?: unknown };
    function findNode(node: Node, match: (n: Node) => boolean): Node | null {
      if (match(node)) return node;
      for (const child of Array.isArray(node.children) ? (node.children as Node[]) : []) {
        if (typeof child !== 'object' || child === null) continue;
        const found = findNode(child, match);
        if (found) return found;
      }
      return null;
    }

    it('reserves the system area exactly once, in the footer — no tab bar under this screen any more', async () => {
      const view = await renderScreen(() => {});
      await waitFor(() => expect(view.getByLabelText('Livre')).toBeTruthy());

      // Insets mockés à 34 : zone système + `spacing.sm`, comme le footer
      // d'Ajout/Modification.
      expect(flatStyle(view.getByTestId('filters-footer').props.style).paddingBottom).toBe(34 + 8);

      // Et aucun bord `bottom` de SafeAreaView en plus : il doublerait cette zone.
      const safeArea = findNode(view.toJSON() as Node, (n) => n.props.edges !== undefined);
      const edges = safeArea?.props.edges;
      expect(edges).toBeDefined();
      // Selon la version, `edges` arrive en tableau ou en objet (`{ bottom: 'off', … }`).
      const bottomEdge = Array.isArray(edges)
        ? edges.includes('bottom')
        : (edges as Record<string, unknown>).bottom;
      expect([false, undefined, 'off']).toContain(bottomEdge);
    });

    it('keeps a standard, comfortable margin under the last section — not a large fixed padding', async () => {
      const view = await renderScreen(() => {});
      await waitFor(() => expect(view.getByText('Trier par')).toBeTruthy());

      const content = flatStyle(
        view.getByTestId('screen-container-scroll').props.contentContainerStyle,
      );
      expect(content.paddingBottom).toBe(16);
      // La dernière section reste dans la zone défilante, au-dessus du footer.
      const texts = JSON.stringify(view.toJSON());
      expect(texts.indexOf('Meilleur état d’abord')).toBeLessThan(
        texts.indexOf('Appliquer les filtres'),
      );
    });
  });
});
