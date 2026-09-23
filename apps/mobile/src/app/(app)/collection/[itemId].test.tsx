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
  barcode: null,
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
    format: null,
  },
  cd: null,
  dvd: null,
  createdBy: ALIX,
  updatedBy: ALIX,
};

/** Aplatit l'arbre rendu en une liste de textes, dans l'ordre du document — sert
 * uniquement à vérifier un ORDRE d'affichage (ex. les lignes de la section
 * Détails), ce qu'aucune requête `getBy*` ne peut exprimer directement. */
function flattenText(node: unknown): string[] {
  if (node == null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(flattenText);
  if (typeof node === 'object' && 'children' in node) {
    return flattenText((node as { children: unknown }).children);
  }
  return [];
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

  it('shows no country section at all when the item has none', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(BASE_ITEM);
    const view = await renderScreen(<ItemDetailScreen />);
    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    expect(view.queryByText("Pays d'origine")).toBeNull();
  });

  it('shows a single country as one chip', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      countryCodes: ['CA'],
    });
    const view = await renderScreen(<ItemDetailScreen />);
    await waitFor(() => expect(view.getByText("Pays d'origine")).toBeTruthy());
    expect(view.getByText('Canada')).toBeTruthy();
  });

  it('renders every country as its own chip, none lost, for two countries', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      countryCodes: ['US', 'FR'],
    });
    const view = await renderScreen(<ItemDetailScreen />);
    await waitFor(() => expect(view.getByText("Pays d'origine")).toBeTruthy());
    expect(view.getByText('États-Unis')).toBeTruthy();
    expect(view.getByText('France')).toBeTruthy();
    // Deux pastilles distinctes, jamais une seule chaîne jointe (ancien affichage
    // texte tronquable) — voir CountriesRow/CountryChip dans [itemId].tsx.
    expect(view.queryByText('États-Unis, France')).toBeNull();
  });

  it('renders every country as its own chip when there are enough to wrap onto several lines, none lost', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      countryCodes: ['US', 'FR', 'CA', 'GB', 'JP', 'DE', 'IT', 'BR'],
    });
    const view = await renderScreen(<ItemDetailScreen />);
    await waitFor(() => expect(view.getByText("Pays d'origine")).toBeTruthy());
    for (const name of [
      'États-Unis',
      'France',
      'Canada',
      'Royaume-Uni',
      'Japon',
      'Allemagne',
      'Italie',
      'Brésil',
    ]) {
      expect(view.getByText(name)).toBeTruthy();
    }
  });

  it('shows the country label matching the item category (cd)', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      category: { ...BASE_ITEM.category, slug: 'cd' },
      countryCodes: ['GB'],
    });
    const view = await renderScreen(<ItemDetailScreen />);
    await waitFor(() => expect(view.getByText("Pays de l'artiste")).toBeTruthy());
    expect(view.queryByText("Pays d'origine")).toBeNull();
  });

  it('lays out the country chips in a wrappable row, not a single fixed line', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      countryCodes: ['US', 'FR'],
    });
    const view = await renderScreen(<ItemDetailScreen />);
    await waitFor(() => expect(view.getByText("Pays d'origine")).toBeTruthy());

    const chipsRow = view.getByLabelText("Pays d'origine : États-Unis, France");
    const style = [chipsRow.props.style].flat();
    expect(style).toEqual(
      expect.arrayContaining([expect.objectContaining({ flexDirection: 'row', flexWrap: 'wrap' })]),
    );
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

  it('shows the dvd format alongside the other technical details', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      title: 'Dune',
      book: null,
      dvd: {
        itemId: 'item-1',
        director: 'Denis Villeneuve',
        releaseYear: 2021,
        edition: null,
        region: null,
        format: 'Blu-ray',
        durationMinutes: 155,
      },
    });
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('Réalisateur')).toBeTruthy());
    expect(view.getByText('Format')).toBeTruthy();
    expect(view.getByText('Blu-ray')).toBeTruthy();
  });

  it('shows the book physical format translated to a readable French label', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      book: { ...BASE_ITEM.book, format: 'Mass Market Paperback' },
    });
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('Format')).toBeTruthy());
    expect(view.getByText('Poche')).toBeTruthy();
    expect(view.queryByText('Mass Market Paperback')).toBeNull();
  });

  it('falls back to the raw provider value for a book format it does not recognize', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      book: { ...BASE_ITEM.book, format: 'Spiral-bound' },
    });
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('Spiral-bound')).toBeTruthy());
  });

  it('does not show a Format row for a book with no format on file', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(BASE_ITEM);
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    expect(view.queryByText('Format')).toBeNull();
  });

  it('never shows an Album row for a cd item — the title already carries the album name', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      title: 'Discovery',
      book: null,
      cd: {
        itemId: 'item-1',
        artist: 'Daft Punk',
        releaseYear: 2001,
        label: null,
        format: null,
      },
    });
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('Artiste')).toBeTruthy());
    expect(view.queryByText('Album')).toBeNull();
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

  it('orders book metadata rows exactly as the form does (ISBN right after Auteur, before Éditeur)', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      book: {
        itemId: 'item-1',
        author: 'Frank Herbert',
        isbn: '9782070368228',
        publisher: 'Gallimard',
        publicationYear: 1965,
        language: 'fr',
        pageCount: 592,
        format: 'Hardcover',
      },
    });
    const view = await renderScreen(<ItemDetailScreen />);
    await waitFor(() => expect(view.getByText('Auteur')).toBeTruthy());

    const texts = flattenText(view.toJSON());
    const order = ['Auteur', 'ISBN', 'Éditeur', 'Année', 'Langue', 'Pages', 'Format'].map((label) =>
      texts.indexOf(label),
    );
    expect(order.every((index) => index !== -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('shows the barcode as a discrete "Code-barres" row after the other metadata fields, only when present', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(BASE_ITEM);
    const withoutBarcode = await renderScreen(<ItemDetailScreen />);
    await waitFor(() => expect(withoutBarcode.getByText('Dune')).toBeTruthy());
    expect(withoutBarcode.queryByText('Code-barres')).toBeNull();

    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      barcode: '9782070368228',
      book: { ...BASE_ITEM.book, format: 'Hardcover' },
    });
    const withBarcode = await renderScreen(<ItemDetailScreen />);
    await waitFor(() => expect(withBarcode.getByText('Code-barres')).toBeTruthy());
    expect(withBarcode.getByText('9782070368228')).toBeTruthy();

    const texts = flattenText(withBarcode.toJSON());
    expect(texts.indexOf('Format')).toBeLessThan(texts.indexOf('Code-barres'));
  });
});
