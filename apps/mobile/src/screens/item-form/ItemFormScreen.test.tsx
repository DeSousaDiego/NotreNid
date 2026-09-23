import { NetworkError } from '@notre-nid/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useState, type ReactElement } from 'react';
import { Pressable } from 'react-native';

import { AppText, ToastProvider } from '../../components';
import { ThemeProvider } from '../../theme';

import { ItemFormScreen } from './ItemFormScreen';

// expo-image's module-level analytics-integration probing isn't compatible
// with this jest environment (unrelated to what this test exercises) — stub
// it with a no-op component.
jest.mock('expo-image', () => ({ Image: () => null }));

// Le footer fixe (Précédent/Suivant, toujours visible) lit `useSafeAreaInsets`
// directement — ce test ne rend pas de `SafeAreaProvider` réel, seul le hook est
// mocké (même convention que `collection/filters.test.tsx`).
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockApiClient = createMockApiClient();

jest.mock('../../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('../../providers/HouseholdProvider', () => ({
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

const mockRouterReplace = jest.fn();
const mockRouterBack = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    back: () => mockRouterBack(),
  },
}));

function createMockApiClient() {
  return {
    households: { listMembers: jest.fn() },
    items: { create: jest.fn(), update: jest.fn(), get: jest.fn() },
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

const CD_CATEGORY = {
  ...BOOK_CATEGORY,
  id: 'category-cd',
  slug: 'cd',
  name: 'CD',
};

const DVD_CATEGORY = {
  ...BOOK_CATEGORY,
  id: 'category-dvd',
  slug: 'dvd',
  name: 'DVD',
};

const CUSTOM_CATEGORY = {
  ...BOOK_CATEGORY,
  id: 'category-vinyl',
  householdId: 'household-1',
  slug: 'vinyles',
  name: 'Vinyles',
  isSystem: false,
  metadataSchema: [{ key: 'edition', label: 'Édition', type: 'string' as const }],
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

const EXISTING_ITEM = {
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
  category: BOOK_CATEGORY,
  owners: [MEMBER.user],
  book: {
    itemId: 'item-1',
    author: 'Frank Herbert',
    isbn: null,
    publisher: null,
    publicationYear: null,
    language: null,
    pageCount: null,
    format: 'Hardcover',
  },
  cd: null,
  dvd: null,
  createdBy: MEMBER.user,
  updatedBy: MEMBER.user,
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

describe('ItemFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockApiClient.households.listMembers as jest.Mock).mockResolvedValue([MEMBER]);
  });

  it('shows an optional Format field for book on step 1, as free text', async () => {
    const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
    await waitFor(() => expect(view.getByText('Livre')).toBeTruthy());

    const formatField = view.getByLabelText('Format');
    expect(formatField).toBeTruthy();
    expect(formatField.props.value).toBe('');

    await fireEvent.changeText(formatField, 'Broché');
    expect(view.getByLabelText('Format').props.value).toBe('Broché');
  });

  it('shows exactly one Format field for cd and dvd — never a second one alongside book’s', async () => {
    const cdView = await renderScreen(<ItemFormScreen mode="create" category={CD_CATEGORY} />);
    await waitFor(() => expect(cdView.getByText('Artiste')).toBeTruthy());
    expect(cdView.getAllByLabelText('Format')).toHaveLength(1);

    const dvdView = await renderScreen(<ItemFormScreen mode="create" category={DVD_CATEGORY} />);
    await waitFor(() => expect(dvdView.getByText('Réalisateur')).toBeTruthy());
    expect(dvdView.getAllByLabelText('Format')).toHaveLength(1);
  });

  it('never shows a generic Format field for a custom category that does not define one', async () => {
    const view = await renderScreen(<ItemFormScreen mode="create" category={CUSTOM_CATEGORY} />);
    await waitFor(() => expect(view.getByLabelText('Édition')).toBeTruthy());
    expect(view.queryByLabelText('Format')).toBeNull();
  });

  it('blocks moving to step 2 until the title is valid', async () => {
    const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);

    await waitFor(() => expect(view.getByText('Livre')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));

    await waitFor(() => expect(view.getByText('Le titre est requis.')).toBeTruthy());
    expect(mockApiClient.items.create).not.toHaveBeenCalled();
  });

  it('shows the infoMessage banner (dvd "partial" scan) on every step, never blocking submission', async () => {
    const view = await renderScreen(
      <ItemFormScreen
        mode="create"
        category={DVD_CATEGORY}
        infoMessage="Certaines informations n'ont pas pu être trouvées automatiquement. Vérifiez et complétez le formulaire avant l'ajout."
      />,
    );

    await waitFor(() => expect(view.getByText('Réalisateur')).toBeTruthy());
    expect(
      view.getByText(
        "Certaines informations n'ont pas pu être trouvées automatiquement. Vérifiez et complétez le formulaire avant l'ajout.",
      ),
    ).toBeTruthy();
    // Un bandeau d'information, pas un blocage : "Suivant" reste utilisable.
    const nextButton = view.getByRole('button', { name: 'Suivant' });
    expect(nextButton.props.accessibilityState?.disabled).toBeFalsy();
  });

  it('shows no infoMessage banner when the prop is not provided', async () => {
    const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
    await waitFor(() => expect(view.getByText('Livre')).toBeTruthy());
    expect(
      view.queryByText(
        "Certaines informations n'ont pas pu être trouvées automatiquement. Vérifiez et complétez le formulaire avant l'ajout.",
      ),
    ).toBeNull();
  });

  it('creates the item end-to-end across all three steps, with the category fixed from the prop', async () => {
    (mockApiClient.items.create as jest.Mock).mockResolvedValue({ id: 'item-1' });
    const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);

    await waitFor(() => expect(view.getByText('Livre')).toBeTruthy());
    await fireEvent.changeText(view.getByLabelText('Titre'), 'Dune');

    await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
    await waitFor(() => expect(view.getByText('Étape 2 sur 3 — Votre exemplaire')).toBeTruthy());

    await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
    await waitFor(() => expect(view.getByText('Alix')).toBeTruthy());

    await fireEvent.press(view.getByRole('button', { name: 'Alix' }));
    await fireEvent.press(view.getByRole('button', { name: 'Ajouter au nid' }));

    await waitFor(() => expect(mockApiClient.items.create).toHaveBeenCalledTimes(1));
    expect(mockApiClient.items.create).toHaveBeenCalledWith(
      'household-1',
      expect.objectContaining({
        categoryId: 'category-book',
        title: 'Dune',
        ownerIds: ['user-1'],
      }),
    );
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/collection'));
  });

  it('shows a cd form with no Album field anywhere in step 1', async () => {
    const view = await renderScreen(<ItemFormScreen mode="create" category={CD_CATEGORY} />);

    await waitFor(() => expect(view.getByText('Artiste')).toBeTruthy());
    expect(view.queryByText('Album')).toBeNull();
    expect(view.queryByLabelText('Album')).toBeNull();
  });

  it('shows a retryable error state instead of silently emptying the owner picker when the members request fails', async () => {
    (mockApiClient.households.listMembers as jest.Mock).mockRejectedValue(new NetworkError());
    const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);

    await waitFor(() => expect(view.getByText('Membres indisponibles')).toBeTruthy());
    expect(view.queryByLabelText('Titre')).toBeNull();
  });

  it('does not lose data moving between wizard steps (forward and back)', async () => {
    const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);

    await waitFor(() => expect(view.getByText('Livre')).toBeTruthy());
    await fireEvent.changeText(view.getByLabelText('Titre'), 'Dune');
    await fireEvent.changeText(view.getByLabelText('Format'), 'Broché');

    await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
    await waitFor(() => expect(view.getByText('Étape 2 sur 3 — Votre exemplaire')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Précédent' }));

    await waitFor(() => expect(view.getByLabelText('Titre').props.value).toBe('Dune'));
    expect(view.getByLabelText('Format').props.value).toBe('Broché');
  });

  it('regression: a parent re-render with unchanged form data never re-writes the draft, independently of React.memo', async () => {
    const onValuesChange = jest.fn();

    // `onChangeCategoryPress` is rebuilt on every render of this harness — a new
    // reference each time — which deliberately defeats `React.memo`'s shallow prop
    // comparison on `ItemFormScreen`, forcing it to genuinely re-render. This proves
    // the protection lives in the RHF `watch` subscription itself, not in `memo`
    // (which stays a pure optimisation, per the fix — see ItemFormScreen.tsx).
    function Harness() {
      const [tick, setTick] = useState(0);
      return (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="force-rerender"
            onPress={() => setTick((current) => current + 1)}
          >
            <AppText>{`tick: ${tick}`}</AppText>
          </Pressable>
          <ItemFormScreen
            mode="create"
            category={BOOK_CATEGORY}
            onValuesChange={onValuesChange}
            onChangeCategoryPress={() => {}}
          />
        </>
      );
    }

    const view = await renderScreen(<Harness />);
    await waitFor(() => expect(view.getByLabelText('Titre')).toBeTruthy());
    expect(onValuesChange).not.toHaveBeenCalled();

    for (let i = 0; i < 5; i += 1) {
      await fireEvent.press(view.getByLabelText('force-rerender'));
    }
    await waitFor(() => expect(view.getByText('tick: 5')).toBeTruthy());
    expect(onValuesChange).not.toHaveBeenCalled();

    // Une vraie saisie continue, elle, à synchroniser normalement.
    await fireEvent.changeText(view.getByLabelText('Titre'), 'Dune');
    await waitFor(() => expect(onValuesChange).toHaveBeenCalledTimes(1));
    expect(onValuesChange).toHaveBeenCalledWith(expect.objectContaining({ title: 'Dune' }));
  });

  it('shows a discreet "Changer" link on step 1 only when onChangeCategoryPress is provided', async () => {
    const onChangeCategoryPress = jest.fn();
    const withLink = await renderScreen(
      <ItemFormScreen
        mode="create"
        category={BOOK_CATEGORY}
        onChangeCategoryPress={onChangeCategoryPress}
      />,
    );
    await waitFor(() => expect(withLink.getByLabelText('Changer de catégorie')).toBeTruthy());
    await fireEvent.press(withLink.getByLabelText('Changer de catégorie'));
    expect(onChangeCategoryPress).toHaveBeenCalledTimes(1);

    (mockApiClient.items.get as jest.Mock).mockResolvedValue(EXISTING_ITEM);
    const withoutLink = await renderScreen(
      <ItemFormScreen mode="edit" itemId="item-1" category={BOOK_CATEGORY} />,
    );
    await waitFor(() => expect(withoutLink.getByText('Livre')).toBeTruthy());
    expect(withoutLink.queryByLabelText('Changer de catégorie')).toBeNull();
  });

  describe('edit mode', () => {
    beforeEach(() => {
      (mockApiClient.items.get as jest.Mock).mockResolvedValue(EXISTING_ITEM);
    });

    it('loads the existing item and lets it be updated without going through category/mode screens', async () => {
      (mockApiClient.items.update as jest.Mock).mockResolvedValue({ ...EXISTING_ITEM });
      const view = await renderScreen(
        <ItemFormScreen mode="edit" itemId="item-1" category={BOOK_CATEGORY} />,
      );

      await waitFor(() => expect(view.getByLabelText('Titre').props.value).toBe('Dune'));
      await fireEvent.changeText(view.getByLabelText('Titre'), 'Dune (édition collector)');

      await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
      await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
      await fireEvent.press(view.getByRole('button', { name: 'Enregistrer' }));

      await waitFor(() => expect(mockApiClient.items.update).toHaveBeenCalledTimes(1));
      expect(mockApiClient.items.update).toHaveBeenCalledWith(
        'household-1',
        'item-1',
        expect.objectContaining({ title: 'Dune (édition collector)' }),
      );
      await waitFor(() => expect(mockRouterBack).toHaveBeenCalledTimes(1));
    });

    it('loads the stored book format as-is into the editable field, and saves an edited value on update', async () => {
      (mockApiClient.items.update as jest.Mock).mockResolvedValue({ ...EXISTING_ITEM });
      const view = await renderScreen(
        <ItemFormScreen mode="edit" itemId="item-1" category={BOOK_CATEGORY} />,
      );

      // La valeur brute stockée (`Hardcover`) est affichée telle quelle dans le champ
      // éditable, jamais déjà traduite (`Relié`) — voir `formatBookFormatLabel`, qui ne
      // s'applique qu'à l'affichage en fiche détail, jamais à ce champ de formulaire.
      await waitFor(() => expect(view.getByLabelText('Format').props.value).toBe('Hardcover'));

      await fireEvent.changeText(view.getByLabelText('Format'), 'Poche');
      await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
      await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
      await fireEvent.press(view.getByRole('button', { name: 'Enregistrer' }));

      await waitFor(() => expect(mockApiClient.items.update).toHaveBeenCalledTimes(1));
      expect(mockApiClient.items.update).toHaveBeenCalledWith(
        'household-1',
        'item-1',
        expect.objectContaining({ book: expect.objectContaining({ format: 'Poche' }) }),
      );
    });
  });

  describe('barcode field (Bloc 3G)', () => {
    it('shows a Code-barres field for book, cd and dvd', async () => {
      const bookView = await renderScreen(
        <ItemFormScreen mode="create" category={BOOK_CATEGORY} />,
      );
      await waitFor(() => expect(bookView.getByLabelText('Code-barres')).toBeTruthy());

      const cdView = await renderScreen(<ItemFormScreen mode="create" category={CD_CATEGORY} />);
      await waitFor(() => expect(cdView.getByLabelText('Code-barres')).toBeTruthy());

      const dvdView = await renderScreen(<ItemFormScreen mode="create" category={DVD_CATEGORY} />);
      await waitFor(() => expect(dvdView.getByLabelText('Code-barres')).toBeTruthy());
    });

    it('never shows a Code-barres field for a custom category — unchanged current behaviour', async () => {
      const view = await renderScreen(<ItemFormScreen mode="create" category={CUSTOM_CATEGORY} />);
      await waitFor(() => expect(view.getByLabelText('Édition')).toBeTruthy());
      expect(view.queryByLabelText('Code-barres')).toBeNull();
    });

    it('prefills the field from an existing item in edit mode', async () => {
      (mockApiClient.items.get as jest.Mock).mockResolvedValue({
        ...EXISTING_ITEM,
        barcode: '9782070368228',
      });
      const view = await renderScreen(
        <ItemFormScreen mode="edit" itemId="item-1" category={BOOK_CATEGORY} />,
      );
      await waitFor(() =>
        expect(view.getByLabelText('Code-barres').props.value).toBe('9782070368228'),
      );
    });

    it('prefills the field from a barcode scan (initialValues), in create mode', async () => {
      const view = await renderScreen(
        <ItemFormScreen
          mode="create"
          category={DVD_CATEGORY}
          initialValues={{ barcode: '065935831686' }}
        />,
      );
      await waitFor(() =>
        expect(view.getByLabelText('Code-barres').props.value).toBe('065935831686'),
      );
    });

    it('strips non-digit characters as the user types, preserving a leading zero — never a Number round-trip', async () => {
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
      await waitFor(() => expect(view.getByLabelText('Code-barres')).toBeTruthy());

      await fireEvent.changeText(view.getByLabelText('Code-barres'), '0a1b2c');
      expect(view.getByLabelText('Code-barres').props.value).toBe('012');
    });

    it('sends the typed barcode to the API when creating manually, with no scan involved', async () => {
      (mockApiClient.items.create as jest.Mock).mockResolvedValue({ id: 'item-1' });
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);

      await waitFor(() => expect(view.getByLabelText('Code-barres')).toBeTruthy());
      await fireEvent.changeText(view.getByLabelText('Titre'), 'Dune');
      await fireEvent.changeText(view.getByLabelText('Code-barres'), '012345678905');

      await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
      await waitFor(() => expect(view.getByText('Étape 2 sur 3 — Votre exemplaire')).toBeTruthy());
      await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
      await waitFor(() => expect(view.getByText('Alix')).toBeTruthy());
      await fireEvent.press(view.getByRole('button', { name: 'Alix' }));
      await fireEvent.press(view.getByRole('button', { name: 'Ajouter au nid' }));

      await waitFor(() => expect(mockApiClient.items.create).toHaveBeenCalledTimes(1));
      expect(mockApiClient.items.create).toHaveBeenCalledWith(
        'household-1',
        // Zéro initial conservé (jamais de conversion Number).
        expect.objectContaining({ barcode: '012345678905' }),
      );
    });

    it('sends the new barcode value on update when changed', async () => {
      (mockApiClient.items.get as jest.Mock).mockResolvedValue({
        ...EXISTING_ITEM,
        barcode: '9782070368228',
      });
      (mockApiClient.items.update as jest.Mock).mockResolvedValue({ ...EXISTING_ITEM });
      const view = await renderScreen(
        <ItemFormScreen mode="edit" itemId="item-1" category={BOOK_CATEGORY} />,
      );

      await waitFor(() =>
        expect(view.getByLabelText('Code-barres').props.value).toBe('9782070368228'),
      );
      await fireEvent.changeText(view.getByLabelText('Code-barres'), '3600029412578');

      await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
      await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
      await fireEvent.press(view.getByRole('button', { name: 'Enregistrer' }));

      await waitFor(() => expect(mockApiClient.items.update).toHaveBeenCalledTimes(1));
      expect(mockApiClient.items.update).toHaveBeenCalledWith(
        'household-1',
        'item-1',
        expect.objectContaining({ barcode: '3600029412578' }),
      );
    });

    it('sends an explicit null (not merely omitted) when the barcode is cleared on update', async () => {
      (mockApiClient.items.get as jest.Mock).mockResolvedValue({
        ...EXISTING_ITEM,
        barcode: '9782070368228',
      });
      (mockApiClient.items.update as jest.Mock).mockResolvedValue({ ...EXISTING_ITEM });
      const view = await renderScreen(
        <ItemFormScreen mode="edit" itemId="item-1" category={BOOK_CATEGORY} />,
      );

      await waitFor(() =>
        expect(view.getByLabelText('Code-barres').props.value).toBe('9782070368228'),
      );
      await fireEvent.changeText(view.getByLabelText('Code-barres'), '');

      await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
      await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
      await fireEvent.press(view.getByRole('button', { name: 'Enregistrer' }));

      await waitFor(() => expect(mockApiClient.items.update).toHaveBeenCalledTimes(1));
      expect(mockApiClient.items.update).toHaveBeenCalledWith(
        'household-1',
        'item-1',
        expect.objectContaining({ barcode: null }),
      );
    });

    it('keeps ISBN and the generic barcode fully independent — never synced with one another', async () => {
      (mockApiClient.items.create as jest.Mock).mockResolvedValue({ id: 'item-1' });
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);

      await waitFor(() => expect(view.getByLabelText('ISBN')).toBeTruthy());
      await fireEvent.changeText(view.getByLabelText('Titre'), 'Dune');
      await fireEvent.changeText(view.getByLabelText('ISBN'), '9782070368228');
      await fireEvent.changeText(view.getByLabelText('Code-barres'), '3600029412578');

      expect(view.getByLabelText('ISBN').props.value).toBe('9782070368228');
      expect(view.getByLabelText('Code-barres').props.value).toBe('3600029412578');

      await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
      await waitFor(() => expect(view.getByText('Étape 2 sur 3 — Votre exemplaire')).toBeTruthy());
      await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
      await waitFor(() => expect(view.getByText('Alix')).toBeTruthy());
      await fireEvent.press(view.getByRole('button', { name: 'Alix' }));
      await fireEvent.press(view.getByRole('button', { name: 'Ajouter au nid' }));

      await waitFor(() => expect(mockApiClient.items.create).toHaveBeenCalledTimes(1));
      expect(mockApiClient.items.create).toHaveBeenCalledWith(
        'household-1',
        expect.objectContaining({
          barcode: '3600029412578',
          book: expect.objectContaining({ isbn: '9782070368228' }),
        }),
      );
    });
  });
});
