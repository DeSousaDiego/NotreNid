import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import {
  AddItemDraftProvider,
  useAddItemDraft,
  type AddItemDraft,
} from '../../../screens/add-item/AddItemDraftContext';
import type { ItemFormValues } from '../../../screens/item-form/schema';
import { ThemeProvider } from '../../../theme';

import AddItemScanScreen from './scan';

jest.mock('expo-image', () => ({ Image: () => null }));

const mockRouterReplace = jest.fn();
const mockRouterDismissTo = jest.fn();
// Mutable plutôt qu'une valeur figée : les tests CD ont besoin d'un
// `categoryId` différent, et `jest.mock` est hissé avant toute déclaration —
// une fermeture sur une variable modifiable évite de dupliquer le mock.
let mockCurrentCategoryId = 'cat-book';
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    dismissTo: (...args: unknown[]) => mockRouterDismissTo(...args),
  },
  useLocalSearchParams: () => ({ categoryId: mockCurrentCategoryId }),
}));

const mockApiClient = {
  categories: { list: jest.fn() },
  items: { resolveBarcode: jest.fn() },
} as unknown as import('@notre-nid/api-client').ApiClient;

jest.mock('../../../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('../../../providers/HouseholdProvider', () => ({
  useHousehold: () => ({ householdId: 'household-1' }),
}));

const BOOK_CATEGORY = {
  id: 'cat-book',
  householdId: null,
  name: 'Livre',
  slug: 'book',
  icon: null,
  isSystem: true,
  metadataSchema: null,
  createdAt: '',
  updatedAt: '',
};

const CD_CATEGORY = { ...BOOK_CATEGORY, id: 'cat-cd', slug: 'cd', name: 'CD' };

const MATCHED_RESULT = {
  barcode: '9782070368228',
  category: 'book',
  status: 'matched',
  match: true,
  source: 'google-books',
  data: {
    title: 'Dune',
    description: "L'histoire de Paul Atréides.",
    book: {
      author: 'Frank Herbert',
      isbn: '9782070368228',
      publisher: 'Gallimard',
      publicationYear: 1970,
      language: 'fr',
      pageCount: 592,
      format: 'Hardcover',
    },
  },
  cover: { url: 'https://example.test/cover.jpg' },
};

const MATCHED_CD_RESULT = {
  barcode: '5099969236424',
  category: 'cd',
  status: 'matched',
  match: true,
  source: 'musicbrainz',
  data: {
    title: 'Discovery',
    description: null,
    // `format` représente le boîtier ("Jewel Case"), pas le support (CD) —
    // voir docs/DECISIONS.md.
    cd: {
      artist: 'Daft Punk',
      releaseYear: 2001,
      label: 'Daft Life',
      format: 'Jewel Case',
      artistCountry: null,
    },
  },
  cover: { url: 'https://example.test/discovery-cover.jpg' },
};

function Harness({
  draftRef,
  seed,
}: {
  draftRef: { current: AddItemDraft | null };
  seed?: Partial<ItemFormValues>;
}) {
  return (
    <AddItemDraftProvider>
      <DraftBridge draftRef={draftRef} seed={seed} />
      <AddItemScanScreen />
    </AddItemDraftProvider>
  );
}

function DraftBridge({
  draftRef,
  seed,
}: {
  draftRef: { current: AddItemDraft | null };
  seed?: Partial<ItemFormValues>;
}) {
  const draft = useAddItemDraft();
  useEffect(() => {
    draftRef.current = draft.draft;
  });
  useEffect(() => {
    if (seed) draft.setValues(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

async function renderScreen(seed?: Partial<ItemFormValues>) {
  const draftRef: { current: AddItemDraft | null } = { current: null };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = await render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider fontsLoaded={false}>
        <Harness draftRef={draftRef} seed={seed} />
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { view, draftRef };
}

describe('AddItemScanScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentCategoryId = 'cat-book';
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([BOOK_CATEGORY, CD_CATEGORY]);
  });

  it('renders a manual barcode input and a search button', async () => {
    const { view } = await renderScreen();
    await waitFor(() => expect(view.getByLabelText('Code-barres')).toBeTruthy());
    expect(view.getByRole('button', { name: 'Rechercher' })).toBeTruthy();
  });

  it('shows a loading state while the search is in flight', async () => {
    let resolveLookup!: (value: unknown) => void;
    (mockApiClient.items.resolveBarcode as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveLookup = resolve;
      }),
    );
    const { view } = await renderScreen();

    await waitFor(() => expect(view.getByLabelText('Code-barres')).toBeTruthy());
    await fireEvent.changeText(view.getByLabelText('Code-barres'), '9782070368228');
    await fireEvent.press(view.getByRole('button', { name: 'Rechercher' }));

    await waitFor(() => expect(view.getByLabelText('Code-barres').props.editable).toBe(false));

    resolveLookup({ ...MATCHED_RESULT });
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled());
  });

  it('shows a clean message and does not navigate when nothing matches', async () => {
    (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue({
      barcode: '9782070368228',
      category: 'book',
      status: 'no_match',
      match: false,
      source: null,
      data: null,
      cover: null,
    });
    const { view } = await renderScreen();

    await waitFor(() => expect(view.getByLabelText('Code-barres')).toBeTruthy());
    await fireEvent.changeText(view.getByLabelText('Code-barres'), '9782070368228');
    await fireEvent.press(view.getByRole('button', { name: 'Rechercher' }));

    await waitFor(() => expect(view.getByText(/Aucun résultat pour ce code-barres/)).toBeTruthy());
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('shows an explicit message for a category the API does not support yet', async () => {
    (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue({
      barcode: '036000291452',
      category: 'book',
      status: 'unsupported',
      match: false,
      source: null,
      data: null,
      cover: null,
    });
    const { view } = await renderScreen();

    await waitFor(() => expect(view.getByLabelText('Code-barres')).toBeTruthy());
    await fireEvent.changeText(view.getByLabelText('Code-barres'), '036000291452');
    await fireEvent.press(view.getByRole('button', { name: 'Rechercher' }));

    await waitFor(() =>
      expect(view.getByText(/n’est pas encore disponible pour cette catégorie/)).toBeTruthy(),
    );
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('shows a distinct message when every external provider failed (provider_error)', async () => {
    (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue({
      barcode: '9782070368228',
      category: 'book',
      status: 'provider_error',
      match: false,
      source: null,
      data: null,
      cover: null,
    });
    const { view } = await renderScreen();

    await waitFor(() => expect(view.getByLabelText('Code-barres')).toBeTruthy());
    await fireEvent.changeText(view.getByLabelText('Code-barres'), '9782070368228');
    await fireEvent.press(view.getByRole('button', { name: 'Rechercher' }));

    await waitFor(() => expect(view.getByText(/momentanément indisponible/)).toBeTruthy());
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('shows an error message when the request itself fails (network/API error)', async () => {
    (mockApiClient.items.resolveBarcode as jest.Mock).mockRejectedValue(new Error('Hors ligne.'));
    const { view } = await renderScreen();

    await waitFor(() => expect(view.getByLabelText('Code-barres')).toBeTruthy());
    await fireEvent.changeText(view.getByLabelText('Code-barres'), '9782070368228');
    await fireEvent.press(view.getByRole('button', { name: 'Rechercher' }));

    await waitFor(() =>
      expect(view.getByText("Une erreur inattendue s'est produite.")).toBeTruthy(),
    );
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('on success, prefills the draft with objective fields only and navigates to the form', async () => {
    (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue(MATCHED_RESULT);
    const { view, draftRef } = await renderScreen();

    await waitFor(() => expect(view.getByLabelText('Code-barres')).toBeTruthy());
    await fireEvent.changeText(view.getByLabelText('Code-barres'), '9782070368228');
    await fireEvent.press(view.getByRole('button', { name: 'Rechercher' }));

    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith({
        pathname: '/(app)/add-item/form',
        params: { categoryId: 'cat-book' },
      }),
    );

    expect(draftRef.current?.values).toEqual({
      barcode: '9782070368228',
      title: 'Dune',
      description: "L'histoire de Paul Atréides.",
      coverImageUrl: 'https://example.test/cover.jpg',
      metadata: {
        author: 'Frank Herbert',
        isbn: '9782070368228',
        publisher: 'Gallimard',
        publicationYear: '1970',
        language: 'fr',
        pageCount: '592',
        format: 'Hardcover',
      },
    });
  });

  it('never prefills condition, rating, notes or ownerIds from a scan result', async () => {
    (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue(MATCHED_RESULT);
    const { view, draftRef } = await renderScreen();

    await waitFor(() => expect(view.getByLabelText('Code-barres')).toBeTruthy());
    await fireEvent.changeText(view.getByLabelText('Code-barres'), '9782070368228');
    await fireEvent.press(view.getByRole('button', { name: 'Rechercher' }));

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled());

    expect(draftRef.current?.values).not.toHaveProperty('condition');
    expect(draftRef.current?.values).not.toHaveProperty('rating');
    expect(draftRef.current?.values).not.toHaveProperty('notes');
    expect(draftRef.current?.values).not.toHaveProperty('ownerIds');
  });

  it('a scan result never overwrites unrelated fields already present in the draft', async () => {
    (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue(MATCHED_RESULT);
    const { view, draftRef } = await renderScreen({
      ownerIds: ['user-1'],
      metadata: { publisher: 'Déjà saisi à la main' },
    });

    await waitFor(() => expect(view.getByLabelText('Code-barres')).toBeTruthy());
    await fireEvent.changeText(view.getByLabelText('Code-barres'), '9782070368228');
    await fireEvent.press(view.getByRole('button', { name: 'Rechercher' }));

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled());

    // `ownerIds` (hors de `metadata`) reste intact ; `metadata.publisher` est écrasé
    // par la valeur du scan (même clé) — comportement attendu, seule une clé absente
    // du résultat du scan doit être préservée.
    expect(draftRef.current?.values?.ownerIds).toEqual(['user-1']);
    expect(draftRef.current?.values?.metadata).toMatchObject({ publisher: 'Gallimard' });
  });

  it('falls back to the manual form via "Saisir manuellement à la place", without calling the API', async () => {
    const { view } = await renderScreen();
    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Saisir manuellement à la place' })).toBeTruthy(),
    );

    await fireEvent.press(view.getByRole('button', { name: 'Saisir manuellement à la place' }));

    expect(mockApiClient.items.resolveBarcode).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith({
        pathname: '/(app)/add-item/form',
        params: { categoryId: 'cat-book' },
      }),
    );
  });

  describe('cd', () => {
    beforeEach(() => {
      mockCurrentCategoryId = 'cat-cd';
    });

    it('on success, prefills the draft with title, artist, year, label, format and cover', async () => {
      (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue(MATCHED_CD_RESULT);
      const { view, draftRef } = await renderScreen();

      await waitFor(() => expect(view.getByLabelText('Code-barres')).toBeTruthy());
      await fireEvent.changeText(view.getByLabelText('Code-barres'), '5099969236424');
      await fireEvent.press(view.getByRole('button', { name: 'Rechercher' }));

      await waitFor(() =>
        expect(mockRouterReplace).toHaveBeenCalledWith({
          pathname: '/(app)/add-item/form',
          params: { categoryId: 'cat-cd' },
        }),
      );

      expect(draftRef.current?.values).toEqual({
        barcode: '5099969236424',
        title: 'Discovery',
        coverImageUrl: 'https://example.test/discovery-cover.jpg',
        metadata: {
          artist: 'Daft Punk',
          releaseYear: '2001',
          label: 'Daft Life',
          format: 'Jewel Case',
        },
      });
    });

    it('flow: a scan with a valid cd.artistCountry prefills draft.values.countryCodes, the same field ItemFormScreen initializes its CountrySelect from', async () => {
      (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue({
        ...MATCHED_CD_RESULT,
        data: {
          ...MATCHED_CD_RESULT.data,
          cd: { ...MATCHED_CD_RESULT.data.cd, artistCountry: 'FR' },
        },
      });
      const { view, draftRef } = await renderScreen();

      await waitFor(() => expect(view.getByLabelText('Code-barres')).toBeTruthy());
      await fireEvent.changeText(view.getByLabelText('Code-barres'), '5099969236424');
      await fireEvent.press(view.getByRole('button', { name: 'Rechercher' }));

      await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled());

      expect(draftRef.current?.values?.countryCodes).toEqual(['FR']);
    });

    it('never prefills condition, rating, notes or ownerIds for a cd scan either', async () => {
      (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue(MATCHED_CD_RESULT);
      const { view, draftRef } = await renderScreen();

      await waitFor(() => expect(view.getByLabelText('Code-barres')).toBeTruthy());
      await fireEvent.changeText(view.getByLabelText('Code-barres'), '5099969236424');
      await fireEvent.press(view.getByRole('button', { name: 'Rechercher' }));

      await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled());

      expect(draftRef.current?.values).not.toHaveProperty('condition');
      expect(draftRef.current?.values).not.toHaveProperty('rating');
      expect(draftRef.current?.values).not.toHaveProperty('notes');
      expect(draftRef.current?.values).not.toHaveProperty('ownerIds');
    });

    it('prefills whatever MusicBrainz actually returned when the match is partial (no cover, no label)', async () => {
      (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue({
        ...MATCHED_CD_RESULT,
        data: {
          title: 'Discovery',
          description: null,
          cd: { artist: 'Daft Punk', releaseYear: null, label: null, format: null },
        },
        cover: null,
      });
      const { view, draftRef } = await renderScreen();

      await waitFor(() => expect(view.getByLabelText('Code-barres')).toBeTruthy());
      await fireEvent.changeText(view.getByLabelText('Code-barres'), '5099969236424');
      await fireEvent.press(view.getByRole('button', { name: 'Rechercher' }));

      await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled());

      expect(draftRef.current?.values).not.toHaveProperty('coverImageUrl');
      expect(draftRef.current?.values?.metadata).toEqual({ artist: 'Daft Punk' });
    });

    it('shows a clean message and does not navigate when cd search finds nothing', async () => {
      (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue({
        barcode: '5099969236424',
        category: 'cd',
        status: 'no_match',
        match: false,
        source: null,
        data: null,
        cover: null,
      });
      const { view } = await renderScreen();

      await waitFor(() => expect(view.getByLabelText('Code-barres')).toBeTruthy());
      await fireEvent.changeText(view.getByLabelText('Code-barres'), '5099969236424');
      await fireEvent.press(view.getByRole('button', { name: 'Rechercher' }));

      await waitFor(() =>
        expect(view.getByText(/Aucun résultat pour ce code-barres/)).toBeTruthy(),
      );
      expect(mockRouterReplace).not.toHaveBeenCalled();
    });

    it('cd is no longer "unsupported" — a provider_error still shows the same message as book', async () => {
      (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue({
        barcode: '5099969236424',
        category: 'cd',
        status: 'provider_error',
        match: false,
        source: null,
        data: null,
        cover: null,
      });
      const { view } = await renderScreen();

      await waitFor(() => expect(view.getByLabelText('Code-barres')).toBeTruthy());
      await fireEvent.changeText(view.getByLabelText('Code-barres'), '5099969236424');
      await fireEvent.press(view.getByRole('button', { name: 'Rechercher' }));

      await waitFor(() => expect(view.getByText(/momentanément indisponible/)).toBeTruthy());
      expect(mockRouterReplace).not.toHaveBeenCalled();
    });
  });
});
