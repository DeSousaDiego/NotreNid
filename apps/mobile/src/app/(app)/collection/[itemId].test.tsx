import { ApiError, NetworkError } from '@notre-nid/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
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
const mockStackScreen = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
  Stack: {
    Screen: (props: { options?: { title?: string } }) => {
      mockStackScreen(props);
      return null;
    },
  },
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

function renderScreen(
  ui: ReactElement,
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
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

  it('names every owner in plain words, not only through avatars', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      owners: [ALIX, ELLIE],
    });
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    expect(view.getByText('À Alix et Ellie')).toBeTruthy();
  });

  it('names a single owner', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(BASE_ITEM);
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('À Alix')).toBeTruthy());
  });

  it('shows the creator and year right under the title, never repeated in the sections below', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      book: { ...BASE_ITEM.book, publicationYear: 1965, publisher: 'Robert Laffont' },
    });
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('Frank Herbert · 1965')).toBeTruthy());
    const texts = flattenText(view.toJSON());
    expect(texts.indexOf('Dune')).toBeLessThan(texts.indexOf('Frank Herbert · 1965'));
    expect(view.queryByText('Auteur')).toBeNull();
    expect(view.queryByText('Année')).toBeNull();
    expect(view.getByText('Éditeur')).toBeTruthy();
  });

  it('shows no credit line at all when neither creator nor year is known', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      book: { ...BASE_ITEM.book, author: null },
    });
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    expect(view.queryByText(/·/)).toBeNull();
  });

  it('marks the item title as the screen heading and never sets it as the native header title', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(BASE_ITEM);
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByRole('header', { name: 'Dune' })).toBeTruthy());
    expect(view.getAllByText('Dune')).toHaveLength(1);
    expect(mockStackScreen).not.toHaveBeenCalledWith(
      expect.objectContaining({ options: expect.objectContaining({ title: 'Dune' }) }),
    );
  });

  it('shows personal notes in their own "Vos notes" block, before the identifiers', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      notes: 'Offert par mamie pour nos trois ans.',
      barcode: '9782070368228',
    });
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('Vos notes')).toBeTruthy());
    expect(view.getByRole('header', { name: 'Vos notes' })).toBeTruthy();
    const texts = flattenText(view.toJSON());
    expect(texts.indexOf('Offert par mamie pour nos trois ans.')).toBeLessThan(
      texts.indexOf('Identifiants'),
    );
  });

  it('shows no "Vos notes" block when the item has no notes', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(BASE_ITEM);
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    expect(view.queryByText('Vos notes')).toBeNull();
    expect(view.queryByTestId('personal-notes')).toBeNull();
  });

  it('groups ISBN, region and barcode under "Identifiants", apart from the edition details', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      barcode: '3333297000000',
      book: null,
      dvd: {
        itemId: 'item-1',
        director: 'Denis Villeneuve',
        releaseYear: 2021,
        edition: 'Collector',
        region: '2',
        format: 'Blu-ray',
        durationMinutes: 155,
      },
    });
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('À propos de cette édition')).toBeTruthy());
    const texts = flattenText(view.toJSON());
    const identifiers = texts.indexOf('Identifiants');
    for (const label of ['Édition', 'Format', 'Durée', 'État']) {
      expect(texts.indexOf(label)).toBeGreaterThan(texts.indexOf('À propos de cette édition'));
      expect(texts.indexOf(label)).toBeLessThan(identifiers);
    }
    for (const label of ['Région', 'Code-barres']) {
      expect(texts.indexOf(label)).toBeGreaterThan(identifiers);
    }
    expect(view.getByRole('header', { name: 'Identifiants' })).toBeTruthy();
  });

  it('shows no "Identifiants" section when the item has none', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(BASE_ITEM);
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    expect(view.queryByText('Identifiants')).toBeNull();
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

    await waitFor(() => expect(view.getByText('Denis Villeneuve · 2021')).toBeTruthy());
    expect(view.queryByText('Réalisateur')).toBeNull();
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
      category: { ...BASE_ITEM.category, id: 'cat-cd', slug: 'cd', name: 'CD' },
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

    await waitFor(() => expect(view.getByText('Daft Punk · 2001')).toBeTruthy());
    expect(view.queryByText('Artiste')).toBeNull();
    expect(view.queryByText('Album')).toBeNull();
    expect(view.getByText('À propos de cet album')).toBeTruthy();
  });

  it('uses the category schema labels and order for custom metadata, with booleans as Oui/Non', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      category: {
        ...BASE_ITEM.category,
        slug: 'jeux',
        name: 'Jeux',
        isSystem: false,
        metadataSchema: [
          { key: 'players', label: 'Nombre de joueurs', type: 'number' },
          { key: 'complete', label: 'Boîte complète', type: 'boolean' },
          { key: 'cooperative', label: 'Coopératif', type: 'boolean' },
        ],
      },
      book: null,
      customMetadata: { cooperative: false, legacyNote: 'v2', complete: true, players: 4 },
    });
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('À propos de cet objet')).toBeTruthy());
    expect(view.getByText('Oui')).toBeTruthy();
    expect(view.getByText('Non')).toBeTruthy();
    expect(view.queryByText('true')).toBeNull();
    expect(view.queryByText('false')).toBeNull();

    const texts = flattenText(view.toJSON());
    const order = ['Nombre de joueurs', 'Boîte complète', 'Coopératif', 'Legacy note'].map(
      (label) => texts.indexOf(label),
    );
    expect(order.every((index) => index !== -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('humanizes customMetadata keys for a custom category (camelCase/snake_case), leaving values untouched', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      category: { ...BASE_ITEM.category, slug: 'vinyles', name: 'Vinyles', isSystem: false },
      book: null,
      customMetadata: { releaseFormat: '180g', purchase_date: '2026-01-01' },
    });
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('Release format')).toBeTruthy());
    expect(view.getByText('180g')).toBeTruthy();
    expect(view.getByText('Purchase date')).toBeTruthy();
    expect(view.getByText('2026-01-01')).toBeTruthy();
    expect(view.queryByText('releaseFormat')).toBeNull();
    expect(view.queryByText('purchase_date')).toBeNull();
  });

  it('shows the floating edit button for an active item, navigating to the edit screen', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(BASE_ITEM);
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    await fireEvent.press(view.getByLabelText('Modifier cet objet'));

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/(app)/collection/edit/[itemId]',
      params: { itemId: 'item-1' },
    });
  });

  it('offers archiving as a discreet row at the end of the content, never as a second FAB', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      barcode: '9782070368228',
    });
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByLabelText('Modifier cet objet')).toBeTruthy());
    expect(view.getByRole('button', { name: 'Archiver cet objet' })).toBeTruthy();
    expect(view.getByText('Vous pourrez le restaurer à tout moment.')).toBeTruthy();
    expect(view.queryByLabelText(/cet item/)).toBeNull();

    const texts = flattenText(view.toJSON());
    expect(texts.indexOf('Archiver cet objet')).toBeGreaterThan(texts.indexOf('Code-barres'));
    expect(texts.indexOf('Archiver cet objet')).toBeGreaterThan(
      texts.findIndex((text) => text.startsWith('Ajouté par')),
    );
  });

  it('shows an archived banner at the top with a labelled restore button, and no Modifier/Archiver', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      archivedAt: '2026-02-01T00:00:00.000Z',
    });
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() =>
      expect(view.getByText('Cet objet est rangé dans les archives.')).toBeTruthy(),
    );
    expect(view.getByRole('button', { name: 'Remettre dans la collection' })).toBeTruthy();
    expect(view.queryByLabelText('Modifier cet objet')).toBeNull();
    expect(view.queryByRole('button', { name: 'Archiver cet objet' })).toBeNull();

    const texts = flattenText(view.toJSON());
    expect(texts.indexOf('Cet objet est rangé dans les archives.')).toBeLessThan(
      texts.indexOf('Dune'),
    );
  });

  it('shows no archived banner for an active item', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(BASE_ITEM);
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
    expect(view.queryByTestId('archived-banner')).toBeNull();
  });

  it('archives the item from its row after confirmation', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(BASE_ITEM);
    (mockApiClient.items.archive as jest.Mock).mockResolvedValue(undefined);
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Archiver cet objet' })).toBeTruthy(),
    );
    await fireEvent.press(view.getByRole('button', { name: 'Archiver cet objet' }));

    await waitFor(() => expect(view.getByText('Archiver cet objet ?')).toBeTruthy());
    expect(mockApiClient.items.archive).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole('button', { name: 'Archiver' }));

    await waitFor(() =>
      expect(mockApiClient.items.archive).toHaveBeenCalledWith('household-1', 'item-1'),
    );
  });

  it('restores an archived item from the banner button, without a confirmation step (same as before)', async () => {
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      archivedAt: '2026-02-01T00:00:00.000Z',
    });
    (mockApiClient.items.restore as jest.Mock).mockResolvedValue(undefined);
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Remettre dans la collection' })).toBeTruthy(),
    );
    await fireEvent.press(view.getByRole('button', { name: 'Remettre dans la collection' }));

    await waitFor(() =>
      expect(mockApiClient.items.restore).toHaveBeenCalledWith('household-1', 'item-1'),
    );
  });

  it('keeps the form order for book details (Éditeur, Langue, Pages, Format) and puts the ISBN under Identifiants', async () => {
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
    await waitFor(() => expect(view.getByText('Frank Herbert · 1965')).toBeTruthy());

    const texts = flattenText(view.toJSON());
    const order = [
      'À propos de cette édition',
      'Éditeur',
      'Langue',
      'Pages',
      'Format',
      'État',
      'Identifiants',
      'ISBN',
    ].map((label) => texts.indexOf(label));
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

  it('lets a long metadata value wrap within the row instead of pushing it off screen', async () => {
    const longEdition = 'Édition collector 2 DVD + livret illustré de 64 pages';
    (mockApiClient.items.get as jest.Mock).mockResolvedValue({
      ...BASE_ITEM,
      book: null,
      dvd: {
        itemId: 'item-1',
        director: 'Denis Villeneuve',
        releaseYear: null,
        edition: longEdition,
        region: null,
        format: null,
        durationMinutes: null,
      },
    });
    const view = await renderScreen(<ItemDetailScreen />);
    await waitFor(() => expect(view.getByText(longEdition)).toBeTruthy());

    const flatStyle = (node: { props: { style?: unknown } }) =>
      Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));

    // La valeur prend l'espace restant (et peut donc passer à la ligne) ; le label,
    // borné en largeur, ne peut plus la repousser hors de la ligne.
    expect(flatStyle(view.getByText(longEdition))).toEqual(
      expect.objectContaining({ flex: 1, textAlign: 'right' }),
    );
    expect(flatStyle(view.getByText('Édition'))).toEqual(
      expect.objectContaining({ flexShrink: 1, maxWidth: '40%' }),
    );
    // Ni `numberOfLines` ni troncature : la valeur reste lisible en entier.
    expect(view.getByText(longEdition).props.numberOfLines).toBeUndefined();
  });
});

describe('ItemDetailScreen — error states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows "Objet introuvable" without a retry for a genuine 404', async () => {
    (mockApiClient.items.get as jest.Mock).mockRejectedValue(
      new ApiError({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: "Cet item n'existe pas.",
        details: [],
      }),
    );
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByText('Objet introuvable')).toBeTruthy());
    expect(
      view.getByText('Cet objet n’existe pas ou n’est plus accessible depuis ce foyer.'),
    ).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Réessayer' })).toBeNull();
  });

  it('shows the generic network message with a retry, never "Objet introuvable", when the API is unreachable', async () => {
    (mockApiClient.items.get as jest.Mock)
      .mockRejectedValueOnce(new NetworkError())
      .mockResolvedValueOnce(BASE_ITEM);
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() =>
      expect(
        view.getByText('Impossible de joindre le service. Vérifiez votre connexion et réessayez.'),
      ).toBeTruthy(),
    );
    expect(view.queryByText('Objet introuvable')).toBeNull();

    await fireEvent.press(view.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());
  });

  it('treats a server error as retryable, not as a missing item', async () => {
    (mockApiClient.items.get as jest.Mock).mockRejectedValue(
      new ApiError({
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Erreur interne.',
        details: [],
      }),
    );
    const view = await renderScreen(<ItemDetailScreen />);

    await waitFor(() => expect(view.getByRole('button', { name: 'Réessayer' })).toBeTruthy());
    expect(view.queryByText('Objet introuvable')).toBeNull();
  });

  it('keeps the item on screen when a background refetch fails', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    (mockApiClient.items.get as jest.Mock)
      .mockResolvedValueOnce(BASE_ITEM)
      .mockRejectedValueOnce(new NetworkError());
    const view = await renderScreen(<ItemDetailScreen />, queryClient);
    await waitFor(() => expect(view.getByText('Dune')).toBeTruthy());

    await act(async () => {
      await queryClient.refetchQueries();
    });

    expect(mockApiClient.items.get).toHaveBeenCalledTimes(2);
    expect(view.getByText('Dune')).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Réessayer' })).toBeNull();
  });
});
