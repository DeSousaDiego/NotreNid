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
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    dismissTo: (...args: unknown[]) => mockRouterDismissTo(...args),
  },
  useLocalSearchParams: () => ({ categoryId: 'cat-book' }),
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
    },
  },
  cover: { url: 'https://example.test/cover.jpg' },
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
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([BOOK_CATEGORY]);
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
});
