import { NetworkError } from '@notre-nid/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useState, type ReactElement } from 'react';
import { BackHandler, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { AppText, ToastProvider } from '../../components';
import {
  GO_BACK_ACTION,
  isRemovalGuarded,
  resetPreventRemoveMock,
  simulateBackAttempt,
} from '../../test-utils/preventRemoveMock';
import { colors, ThemeProvider } from '../../theme';

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
const mockRouterDismissTo = jest.fn();
const mockRouterBack = jest.fn();
const mockNavigationDispatch = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    dismissTo: (...args: unknown[]) => mockRouterDismissTo(...args),
    back: () => mockRouterBack(),
  },
  useNavigation: () => ({ dispatch: mockNavigationDispatch }),
}));

// Garde de retour arrière (`usePreventRemove`) : double contrôlable, voir test-utils.
jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (...args: [boolean, never]) =>
    jest.requireActual('../../test-utils/preventRemoveMock').recordPreventRemove(...args),
}));

// Sélection d'image : toujours « une image choisie dans la galerie », sans picker
// natif — seul le téléversement (contrôlé par chaque test) nous intéresse ici.
jest.mock('../../lib/imagePicker', () => ({
  pickImageFromLibrary: jest.fn(async () => ({
    status: 'picked',
    asset: { uri: 'file:///cover.jpg' },
  })),
  pickImageFromCamera: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  File: class MockFile {
    mockUri: string;
    constructor(mockUri: string) {
      this.mockUri = mockUri;
    }
  },
}));

function createMockApiClient() {
  return {
    households: { listMembers: jest.fn() },
    items: { create: jest.fn(), update: jest.fn(), get: jest.fn() },
    uploads: { upload: jest.fn(), remove: jest.fn() },
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
    await waitFor(() =>
      expect(view.getByLabelText('Étape 2 sur 3, Votre exemplaire')).toBeTruthy(),
    );

    await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
    await waitFor(() => expect(view.getByRole('checkbox', { name: 'Alix' })).toBeTruthy());

    expect(view.getByRole('checkbox', { name: 'Alix' }).props.accessibilityState?.checked).toBe(
      true,
    );
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
    await waitFor(() => expect(mockRouterDismissTo).toHaveBeenCalledWith('/collection'));
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
    await waitFor(() =>
      expect(view.getByLabelText('Étape 2 sur 3, Votre exemplaire')).toBeTruthy(),
    );
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
      await waitFor(() =>
        expect(view.getByLabelText('Étape 2 sur 3, Votre exemplaire')).toBeTruthy(),
      );
      await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
      await waitFor(() => expect(view.getByRole('checkbox', { name: 'Alix' })).toBeTruthy());
      expect(view.getByRole('checkbox', { name: 'Alix' }).props.accessibilityState?.checked).toBe(
        true,
      );
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
      await waitFor(() =>
        expect(view.getByLabelText('Étape 2 sur 3, Votre exemplaire')).toBeTruthy(),
      );
      await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
      await waitFor(() => expect(view.getByRole('checkbox', { name: 'Alix' })).toBeTruthy());
      expect(view.getByRole('checkbox', { name: 'Alix' }).props.accessibilityState?.checked).toBe(
        true,
      );
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

    it('shows a discreet helper text clarifying the barcode/ISBN relationship for a book only', async () => {
      const bookView = await renderScreen(
        <ItemFormScreen mode="create" category={BOOK_CATEGORY} />,
      );
      await waitFor(() => expect(bookView.getByLabelText('Code-barres')).toBeTruthy());
      expect(bookView.getByText('Souvent identique à l’ISBN, mais pas toujours.')).toBeTruthy();

      const cdView = await renderScreen(<ItemFormScreen mode="create" category={CD_CATEGORY} />);
      await waitFor(() => expect(cdView.getByLabelText('Code-barres')).toBeTruthy());
      expect(cdView.queryByText('Souvent identique à l’ISBN, mais pas toujours.')).toBeNull();

      const dvdView = await renderScreen(<ItemFormScreen mode="create" category={DVD_CATEGORY} />);
      await waitFor(() => expect(dvdView.getByLabelText('Code-barres')).toBeTruthy());
      expect(dvdView.queryByText('Souvent identique à l’ISBN, mais pas toujours.')).toBeNull();
    });
  });
});

describe('ItemFormScreen — robustesse (Lot 1)', () => {
  const NETWORK_ERROR_MESSAGE = new NetworkError().message;

  beforeEach(() => {
    jest.clearAllMocks();
    resetPreventRemoveMock();
    (mockApiClient.households.listMembers as jest.Mock).mockResolvedValue([MEMBER]);
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(EXISTING_ITEM);
  });

  type View = Awaited<ReturnType<typeof renderScreen>>;

  /** Remplit le titre, passe les deux premières étapes et coche le propriétaire. */
  async function goToLastStepInCreate(view: View) {
    await waitFor(() => expect(view.getByLabelText('Titre')).toBeTruthy());
    await fireEvent.changeText(view.getByLabelText('Titre'), 'Dune');
    await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
    await waitFor(() =>
      expect(view.getByLabelText('Étape 2 sur 3, Votre exemplaire')).toBeTruthy(),
    );
    await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
    await waitFor(() => expect(view.getByRole('checkbox', { name: 'Alix' })).toBeTruthy());
    expect(view.getByRole('checkbox', { name: 'Alix' }).props.accessibilityState?.checked).toBe(
      true,
    );
  }

  async function goToLastStepInEdit(view: View) {
    await waitFor(() => expect(view.getByLabelText('Titre').props.value).toBe('Dune'));
    await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
    await waitFor(() =>
      expect(view.getByLabelText('Étape 2 sur 3, Votre exemplaire')).toBeTruthy(),
    );
    await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
    await waitFor(() => expect(view.getByLabelText('Étape 3 sur 3, Dans votre nid')).toBeTruthy());
  }

  function isDisabled(view: View, name: string): boolean {
    return Boolean(view.getByRole('button', { name }).props.accessibilityState?.disabled);
  }

  /** Lance un upload de couverture qui reste en cours tant que le test ne le résout pas. */
  async function startPendingCoverUpload(view: View) {
    let finishUpload!: (value: unknown) => void;
    (mockApiClient.uploads.upload as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        finishUpload = resolve;
      }),
    );
    await fireEvent.press(view.getByLabelText('Ajouter une couverture'));
    await fireEvent.press(view.getByLabelText('Choisir dans la galerie'));
    await waitFor(() =>
      expect(
        view.getByText('Envoi de la couverture en cours… Patientez avant de continuer.'),
      ).toBeTruthy(),
    );
    return finishUpload;
  }

  describe('cover upload', () => {
    it('disables the final CTA and "Précédent" while the cover is uploading, and re-enables them afterwards', async () => {
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
      await goToLastStepInCreate(view);

      const finishUpload = await startPendingCoverUpload(view);
      expect(isDisabled(view, 'Ajouter au nid')).toBe(true);
      expect(isDisabled(view, 'Précédent')).toBe(true);

      await act(async () => {
        finishUpload({ id: 'upload-1', url: 'https://cdn.test/cover.jpg' });
      });

      await waitFor(() => expect(isDisabled(view, 'Ajouter au nid')).toBe(false));
      expect(isDisabled(view, 'Précédent')).toBe(false);
      expect(
        view.queryByText('Envoi de la couverture en cours… Patientez avant de continuer.'),
      ).toBeNull();
    });

    it('never submits while the cover is uploading, then sends it with the uploaded cover', async () => {
      (mockApiClient.items.create as jest.Mock).mockResolvedValue({ id: 'item-1' });
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
      await goToLastStepInCreate(view);

      const finishUpload = await startPendingCoverUpload(view);
      await fireEvent.press(view.getByRole('button', { name: 'Ajouter au nid' }));
      expect(mockApiClient.items.create).not.toHaveBeenCalled();

      await act(async () => {
        finishUpload({ id: 'upload-1', url: 'https://cdn.test/cover.jpg' });
      });
      await waitFor(() => expect(isDisabled(view, 'Ajouter au nid')).toBe(false));
      await fireEvent.press(view.getByRole('button', { name: 'Ajouter au nid' }));

      await waitFor(() => expect(mockApiClient.items.create).toHaveBeenCalledTimes(1));
      expect(mockApiClient.items.create).toHaveBeenCalledWith(
        'household-1',
        expect.objectContaining({ coverImageUrl: 'https://cdn.test/cover.jpg' }),
      );
    });

    it('never stays locked when the upload fails: buttons come back and the error is shown', async () => {
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
      await goToLastStepInCreate(view);

      let failUpload!: (reason: unknown) => void;
      (mockApiClient.uploads.upload as jest.Mock).mockReturnValue(
        new Promise((_resolve, reject) => {
          failUpload = reject;
        }),
      );
      await fireEvent.press(view.getByLabelText('Ajouter une couverture'));
      await fireEvent.press(view.getByLabelText('Choisir dans la galerie'));
      await waitFor(() => expect(isDisabled(view, 'Ajouter au nid')).toBe(true));

      await act(async () => {
        failUpload(new NetworkError());
      });

      await waitFor(() => expect(isDisabled(view, 'Ajouter au nid')).toBe(false));
      expect(isDisabled(view, 'Précédent')).toBe(false);
      expect(view.getByText(NETWORK_ERROR_MESSAGE)).toBeTruthy();
    });

    it('ignores a system back attempt while the cover is uploading', async () => {
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
      await goToLastStepInCreate(view);
      await startPendingCoverUpload(view);

      await act(async () => {
        expect(simulateBackAttempt()).toBe(true);
      });

      expect(view.getByLabelText('Étape 3 sur 3, Dans votre nid')).toBeTruthy();
    });
  });

  describe('double submit', () => {
    it('sends a single create request for two immediate taps', async () => {
      let finishCreate!: (value: unknown) => void;
      (mockApiClient.items.create as jest.Mock).mockReturnValue(
        new Promise((resolve) => {
          finishCreate = resolve;
        }),
      );
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
      await goToLastStepInCreate(view);

      // Même élément, deux appuis dans la même frame — avant tout re-rendu qui
      // désactiverait le bouton.
      const submitButton = view.getByRole('button', { name: 'Ajouter au nid' });
      await act(async () => {
        void fireEvent.press(submitButton);
        void fireEvent.press(submitButton);
      });

      await waitFor(() => expect(mockApiClient.items.create).toHaveBeenCalledTimes(1));
      await act(async () => {
        finishCreate({ id: 'item-1' });
      });
      await waitFor(() => expect(mockRouterDismissTo).toHaveBeenCalledWith('/collection'));
      expect(mockApiClient.items.create).toHaveBeenCalledTimes(1);
    });

    it('sends a single update request for two immediate taps', async () => {
      let finishUpdate!: (value: unknown) => void;
      (mockApiClient.items.update as jest.Mock).mockReturnValue(
        new Promise((resolve) => {
          finishUpdate = resolve;
        }),
      );
      const view = await renderScreen(
        <ItemFormScreen mode="edit" itemId="item-1" category={BOOK_CATEGORY} />,
      );
      await goToLastStepInEdit(view);

      const submitButton = view.getByRole('button', { name: 'Enregistrer' });
      await act(async () => {
        void fireEvent.press(submitButton);
        void fireEvent.press(submitButton);
      });

      await waitFor(() => expect(mockApiClient.items.update).toHaveBeenCalledTimes(1));
      await act(async () => {
        finishUpdate({ ...EXISTING_ITEM });
      });
      await waitFor(() => expect(mockRouterBack).toHaveBeenCalledTimes(1));
      expect(mockApiClient.items.update).toHaveBeenCalledTimes(1);
    });

    it('releases the lock after a failed submit so the user can retry', async () => {
      (mockApiClient.items.create as jest.Mock)
        .mockRejectedValueOnce(new NetworkError())
        .mockResolvedValueOnce({ id: 'item-1' });
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
      await goToLastStepInCreate(view);

      await fireEvent.press(view.getByRole('button', { name: 'Ajouter au nid' }));
      await waitFor(() => expect(view.getByTestId('item-form-submit-error')).toBeTruthy());

      await fireEvent.press(view.getByRole('button', { name: 'Ajouter au nid' }));
      await waitFor(() => expect(mockApiClient.items.create).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(mockRouterDismissTo).toHaveBeenCalledWith('/collection'));
    });
  });

  describe('submit error', () => {
    it('shows the API error in the always-visible footer, above the buttons', async () => {
      (mockApiClient.items.create as jest.Mock).mockRejectedValue(new NetworkError());
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
      await goToLastStepInCreate(view);

      await fireEvent.press(view.getByRole('button', { name: 'Ajouter au nid' }));

      await waitFor(() => expect(view.getByTestId('item-form-submit-error')).toBeTruthy());
      expect(view.getByText(NETWORK_ERROR_MESSAGE)).toBeTruthy();
      // Les boutons restent disponibles pour réessayer.
      expect(isDisabled(view, 'Ajouter au nid')).toBe(false);
    });

    it('clears the error as soon as a new attempt starts, and keeps it gone on success', async () => {
      let finishRetry!: (value: unknown) => void;
      (mockApiClient.items.create as jest.Mock)
        .mockRejectedValueOnce(new NetworkError())
        .mockReturnValueOnce(
          new Promise((resolve) => {
            finishRetry = resolve;
          }),
        );
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
      await goToLastStepInCreate(view);

      await fireEvent.press(view.getByRole('button', { name: 'Ajouter au nid' }));
      await waitFor(() => expect(view.getByTestId('item-form-submit-error')).toBeTruthy());

      await fireEvent.press(view.getByRole('button', { name: 'Ajouter au nid' }));
      await waitFor(() => expect(mockApiClient.items.create).toHaveBeenCalledTimes(2));
      expect(view.queryByTestId('item-form-submit-error')).toBeNull();

      await act(async () => {
        finishRetry({ id: 'item-1' });
      });
      await waitFor(() => expect(mockRouterDismissTo).toHaveBeenCalledWith('/collection'));
      expect(view.queryByTestId('item-form-submit-error')).toBeNull();
    });
  });

  describe('back navigation — create', () => {
    it('goes back one step at a time from step 3, then lets step 1 leave the form', async () => {
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
      await goToLastStepInCreate(view);

      await act(async () => {
        expect(simulateBackAttempt()).toBe(true);
      });
      await waitFor(() =>
        expect(view.getByLabelText('Étape 2 sur 3, Votre exemplaire')).toBeTruthy(),
      );

      await act(async () => {
        expect(simulateBackAttempt()).toBe(true);
      });
      await waitFor(() => expect(view.getByLabelText("Étape 1 sur 3, L'objet")).toBeTruthy());
      // Les données saisies sont toujours là.
      expect(view.getByLabelText('Titre').props.value).toBe('Dune');

      // Étape 1 : comportement de sortie inchangé (retour vers l'écran précédent du
      // flow, brouillon conservé par AddItemDraftContext) — aucune interception.
      expect(isRemovalGuarded()).toBe(false);
      expect(simulateBackAttempt()).toBe(false);
      expect(mockNavigationDispatch).not.toHaveBeenCalled();
    });

    it('never intercepts the success navigation after creating', async () => {
      (mockApiClient.items.create as jest.Mock).mockResolvedValue({ id: 'item-1' });
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
      await goToLastStepInCreate(view);

      await fireEvent.press(view.getByRole('button', { name: 'Ajouter au nid' }));

      await waitFor(() => expect(mockRouterDismissTo).toHaveBeenCalledWith('/collection'));
      expect(isRemovalGuarded()).toBe(false);
    });
  });

  describe('back navigation — edit', () => {
    it('goes back one step at a time from step 3 to step 1', async () => {
      const view = await renderScreen(
        <ItemFormScreen mode="edit" itemId="item-1" category={BOOK_CATEGORY} />,
      );
      await goToLastStepInEdit(view);

      await act(async () => {
        expect(simulateBackAttempt()).toBe(true);
      });
      await waitFor(() =>
        expect(view.getByLabelText('Étape 2 sur 3, Votre exemplaire')).toBeTruthy(),
      );

      await act(async () => {
        expect(simulateBackAttempt()).toBe(true);
      });
      await waitFor(() => expect(view.getByLabelText("Étape 1 sur 3, L'objet")).toBeTruthy());
    });

    it('leaves step 1 without any confirmation when nothing was changed', async () => {
      const view = await renderScreen(
        <ItemFormScreen mode="edit" itemId="item-1" category={BOOK_CATEGORY} />,
      );
      await waitFor(() => expect(view.getByLabelText('Titre').props.value).toBe('Dune'));

      expect(isRemovalGuarded()).toBe(false);
      expect(simulateBackAttempt()).toBe(false);
      expect(view.queryByText('Quitter sans enregistrer ?')).toBeNull();
    });

    it('asks for confirmation before leaving step 1 with unsaved changes — "Continuer la modification" stays', async () => {
      const view = await renderScreen(
        <ItemFormScreen mode="edit" itemId="item-1" category={BOOK_CATEGORY} />,
      );
      await waitFor(() => expect(view.getByLabelText('Titre').props.value).toBe('Dune'));
      await fireEvent.changeText(view.getByLabelText('Titre'), 'Dune (collector)');

      await waitFor(() => expect(isRemovalGuarded()).toBe(true));
      await act(async () => {
        expect(simulateBackAttempt()).toBe(true);
      });

      await waitFor(() => expect(view.getByText('Quitter sans enregistrer ?')).toBeTruthy());
      expect(view.getByText('Vos modifications sur cet objet seront perdues.')).toBeTruthy();

      await fireEvent.press(view.getByRole('button', { name: 'Continuer la modification' }));
      await waitFor(() => expect(view.queryByText('Quitter sans enregistrer ?')).toBeNull());
      expect(mockNavigationDispatch).not.toHaveBeenCalled();
      expect(view.getByLabelText('Titre').props.value).toBe('Dune (collector)');
    });

    it('leaves with the original navigation action once "Quitter sans enregistrer" is confirmed', async () => {
      const view = await renderScreen(
        <ItemFormScreen mode="edit" itemId="item-1" category={BOOK_CATEGORY} />,
      );
      await waitFor(() => expect(view.getByLabelText('Titre').props.value).toBe('Dune'));
      await fireEvent.changeText(view.getByLabelText('Titre'), 'Dune (collector)');
      await waitFor(() => expect(isRemovalGuarded()).toBe(true));

      await act(async () => {
        simulateBackAttempt();
      });
      await waitFor(() => expect(view.getByText('Quitter sans enregistrer ?')).toBeTruthy());
      await fireEvent.press(view.getByRole('button', { name: 'Quitter sans enregistrer' }));

      await waitFor(() => expect(mockNavigationDispatch).toHaveBeenCalledWith(GO_BACK_ACTION));
      // Garde désarmée avant la navigation : la sortie confirmée n'est pas ré-interceptée.
      expect(isRemovalGuarded()).toBe(false);
    });

    it('never shows the unsaved-changes confirmation after a successful save', async () => {
      (mockApiClient.items.update as jest.Mock).mockResolvedValue({ ...EXISTING_ITEM });
      const view = await renderScreen(
        <ItemFormScreen mode="edit" itemId="item-1" category={BOOK_CATEGORY} />,
      );
      await waitFor(() => expect(view.getByLabelText('Titre').props.value).toBe('Dune'));
      await fireEvent.changeText(view.getByLabelText('Titre'), 'Dune (collector)');
      await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
      await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
      await fireEvent.press(view.getByRole('button', { name: 'Enregistrer' }));

      await waitFor(() => expect(mockRouterBack).toHaveBeenCalledTimes(1));
      expect(isRemovalGuarded()).toBe(false);
      expect(view.queryByText('Quitter sans enregistrer ?')).toBeNull();
      expect(mockNavigationDispatch).not.toHaveBeenCalled();
    });
  });
});

describe('ItemFormScreen — régressions appareil (hotfix)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPreventRemoveMock();
    (mockApiClient.households.listMembers as jest.Mock).mockResolvedValue([MEMBER]);
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(EXISTING_ITEM);
  });

  type View = Awaited<ReturnType<typeof renderScreen>>;

  async function reachLastStepInCreate(view: View) {
    await waitFor(() => expect(view.getByLabelText('Titre')).toBeTruthy());
    await fireEvent.changeText(view.getByLabelText('Titre'), 'Dune');
    await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
    await waitFor(() =>
      expect(view.getByLabelText('Étape 2 sur 3, Votre exemplaire')).toBeTruthy(),
    );
    await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
    await waitFor(() => expect(view.getByRole('checkbox', { name: 'Alix' })).toBeTruthy());
    expect(view.getByRole('checkbox', { name: 'Alix' }).props.accessibilityState?.checked).toBe(
      true,
    );
  }

  async function reachLastStepInEditWithChange(view: View) {
    await waitFor(() => expect(view.getByLabelText('Titre').props.value).toBe('Dune'));
    await fireEvent.changeText(view.getByLabelText('Titre'), 'Dune (collector)');
    await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
    await waitFor(() =>
      expect(view.getByLabelText('Étape 2 sur 3, Votre exemplaire')).toBeTruthy(),
    );
    await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
    await waitFor(() => expect(view.getByLabelText('Étape 3 sur 3, Dans votre nid')).toBeTruthy());
  }

  function pending<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  /** Capture le gestionnaire « retour matériel » Android enregistré par l'écran. */
  function spyOnHardwareBack() {
    type HardwareBackHandler = Parameters<typeof BackHandler.addEventListener>[1];
    const handlers: HardwareBackHandler[] = [];
    const removed: HardwareBackHandler[] = [];
    const spy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        handlers.push(handler);
        return {
          remove: () => {
            removed.push(handler);
          },
        };
      });
    return { spy, handlers, removed };
  }

  describe('success navigation (black screen)', () => {
    it('create: disarms the guard as soon as the submit starts, then replaces to Collection exactly once, never with the guard armed', async () => {
      const request = pending<unknown>();
      (mockApiClient.items.create as jest.Mock).mockReturnValue(request.promise);
      const guardAtNavigation: boolean[] = [];
      mockRouterDismissTo.mockImplementation(() => guardAtNavigation.push(isRemovalGuarded()));
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
      await reachLastStepInCreate(view);
      // Étape 3 : garde armée (retour = étape précédente).
      expect(isRemovalGuarded()).toBe(true);

      await fireEvent.press(view.getByRole('button', { name: 'Ajouter au nid' }));
      await waitFor(() => expect(mockApiClient.items.create).toHaveBeenCalledTimes(1));

      // Requête encore en vol : garde déjà désarmée (rendu commis), aucune navigation.
      expect(isRemovalGuarded()).toBe(false);
      expect(mockRouterDismissTo).not.toHaveBeenCalled();

      await act(async () => {
        request.resolve({ id: 'item-1' });
      });

      await waitFor(() => expect(mockRouterDismissTo).toHaveBeenCalledTimes(1));
      expect(mockRouterDismissTo).toHaveBeenCalledWith('/collection');
      expect(guardAtNavigation).toEqual([false]);
      // Jamais `replace` : il empilait une seconde instance de (tabs) (écran noir).
      expect(mockRouterReplace).not.toHaveBeenCalled();
      // Jamais réarmée après le succès, jamais de sortie « confirmée » parasite.
      expect(isRemovalGuarded()).toBe(false);
      expect(mockNavigationDispatch).not.toHaveBeenCalled();
      expect(mockRouterBack).not.toHaveBeenCalled();
    });

    it('edit: disarms the guard as soon as the submit starts, then goes back exactly once, never with the guard armed and without confirmation', async () => {
      const request = pending<unknown>();
      (mockApiClient.items.update as jest.Mock).mockReturnValue(request.promise);
      const guardAtNavigation: boolean[] = [];
      mockRouterBack.mockImplementation(() => guardAtNavigation.push(isRemovalGuarded()));
      const view = await renderScreen(
        <ItemFormScreen mode="edit" itemId="item-1" category={BOOK_CATEGORY} />,
      );
      await reachLastStepInEditWithChange(view);
      expect(isRemovalGuarded()).toBe(true);

      await fireEvent.press(view.getByRole('button', { name: 'Enregistrer' }));
      await waitFor(() => expect(mockApiClient.items.update).toHaveBeenCalledTimes(1));
      expect(isRemovalGuarded()).toBe(false);
      expect(mockRouterBack).not.toHaveBeenCalled();

      await act(async () => {
        request.resolve({ ...EXISTING_ITEM, title: 'Dune (collector)' });
      });

      await waitFor(() => expect(mockRouterBack).toHaveBeenCalledTimes(1));
      expect(guardAtNavigation).toEqual([false]);
      expect(isRemovalGuarded()).toBe(false);
      expect(view.queryByText('Quitter sans enregistrer ?')).toBeNull();
      expect(mockNavigationDispatch).not.toHaveBeenCalled();
      expect(mockRouterDismissTo).not.toHaveBeenCalled();
    });

    it('blocks the Android hardware back button during the submit (JS only), and re-arms the guard after a failure', async () => {
      const hardwareBack = spyOnHardwareBack();
      const request = pending<unknown>();
      (mockApiClient.items.create as jest.Mock).mockReturnValue(request.promise);
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
      await reachLastStepInCreate(view);

      await fireEvent.press(view.getByRole('button', { name: 'Ajouter au nid' }));
      await waitFor(() => expect(hardwareBack.handlers).toHaveLength(1));
      // Consommé : ni étape précédente, ni sortie pendant l'envoi.
      expect(
        hardwareBack.handlers[0]!({} as Parameters<(typeof hardwareBack.handlers)[number]>[0]),
      ).toBe(true);
      expect(view.getByLabelText('Étape 3 sur 3, Dans votre nid')).toBeTruthy();

      await act(async () => {
        request.reject(new NetworkError());
      });

      await waitFor(() => expect(view.getByTestId('item-form-submit-error')).toBeTruthy());
      expect(hardwareBack.removed).toEqual(hardwareBack.handlers);
      // Garde réarmée : un retour ramène de nouveau à l'étape 2.
      expect(isRemovalGuarded()).toBe(true);
      expect(mockRouterDismissTo).not.toHaveBeenCalled();
      hardwareBack.spy.mockRestore();
    });
  });

  describe('cover upload lock window', () => {
    const imagePicker = jest.requireMock('../../lib/imagePicker') as {
      pickImageFromLibrary: jest.Mock;
    };

    it('locks the CTA and "Précédent" synchronously when an image source is chosen — a tap in the same frame never submits', async () => {
      const picker = pending<unknown>();
      imagePicker.pickImageFromLibrary.mockReturnValueOnce(picker.promise);
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
      await reachLastStepInCreate(view);

      await fireEvent.press(view.getByLabelText('Ajouter une couverture'));
      await waitFor(() => expect(view.getByLabelText('Choisir dans la galerie')).toBeTruthy());
      const galleryOption = view.getByLabelText('Choisir dans la galerie');
      // Éléments capturés AVANT tout re-rendu : leurs props sont encore « actives ».
      const submitButton = view.getByRole('button', { name: 'Ajouter au nid' });
      const previousButton = view.getByRole('button', { name: 'Précédent' });

      await act(async () => {
        void fireEvent.press(galleryOption);
        void fireEvent.press(submitButton);
        void fireEvent.press(previousButton);
      });

      expect(mockApiClient.items.create).not.toHaveBeenCalled();
      expect(view.getByLabelText('Étape 3 sur 3, Dans votre nid')).toBeTruthy();
      expect(
        view.getByRole('button', { name: 'Ajouter au nid' }).props.accessibilityState?.disabled,
      ).toBe(true);
      expect(
        view.getByRole('button', { name: 'Précédent' }).props.accessibilityState?.disabled,
      ).toBe(true);

      // Sélection annulée : déverrouillage (finally), soumission de nouveau possible.
      await act(async () => {
        picker.resolve({ status: 'cancelled' });
      });
      await waitFor(() =>
        expect(
          view.getByRole('button', { name: 'Ajouter au nid' }).props.accessibilityState?.disabled,
        ).toBe(false),
      );
    });
  });
});

describe('ItemFormScreen — effacement des champs facultatifs en édition (Lot 2)', () => {
  /** Livre existant dont tous les champs facultatifs sont renseignés. */
  const FULL_ITEM = {
    ...EXISTING_ITEM,
    barcode: '9782070368228',
    description: 'Un classique de la SF.',
    notes: 'Dédicacé.',
    rating: 4,
    coverImageUrl: 'https://cdn.test/dune.jpg',
    book: {
      ...EXISTING_ITEM.book,
      author: 'Frank Herbert',
      publisher: 'Gallimard',
      pageCount: 592,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetPreventRemoveMock();
    (mockApiClient.households.listMembers as jest.Mock).mockResolvedValue([MEMBER]);
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(FULL_ITEM);
    (mockApiClient.items.update as jest.Mock).mockResolvedValue({ ...FULL_ITEM });
  });

  type View = Awaited<ReturnType<typeof renderScreen>>;

  async function openEdit() {
    const view = await renderScreen(
      <ItemFormScreen mode="edit" itemId="item-1" category={BOOK_CATEGORY} />,
    );
    await waitFor(() => expect(view.getByLabelText('Titre').props.value).toBe('Dune'));
    return view;
  }

  async function next(view: View) {
    await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
  }

  async function save(view: View) {
    await fireEvent.press(view.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(mockApiClient.items.update).toHaveBeenCalledTimes(1));
    return (mockApiClient.items.update as jest.Mock).mock.calls[0]![2] as Record<string, unknown>;
  }

  it('sends null for an emptied description and emptied text/numeric metadata', async () => {
    const view = await openEdit();
    await fireEvent.changeText(view.getByLabelText('Description'), '');
    await fireEvent.changeText(view.getByLabelText('Auteur'), '');
    await fireEvent.changeText(view.getByLabelText('Nombre de pages'), '');
    await next(view);
    await next(view);

    const input = await save(view);

    expect(input.description).toBeNull();
    expect(input.book).toMatchObject({ author: null, pageCount: null, publisher: 'Gallimard' });
    // Champs non touchés : jamais d'effacement destructeur.
    expect(input.notes).toBe('Dédicacé.');
    expect(input.rating).toBe(4);
    expect(input.coverImageUrl).toBe('https://cdn.test/dune.jpg');
    expect(input.barcode).toBe('9782070368228');
  });

  it('sends null for emptied notes and a removed rating', async () => {
    const view = await openEdit();
    await next(view);
    await waitFor(() =>
      expect(view.getByLabelText('Étape 2 sur 3, Votre exemplaire')).toBeTruthy(),
    );
    await fireEvent.changeText(view.getByLabelText('Notes'), '');
    // Re-toucher la note actuelle la retire (voir StarRating).
    await fireEvent.press(view.getByLabelText('4 sur 5'));
    await next(view);

    const input = await save(view);

    expect(input.notes).toBeNull();
    expect(input.rating).toBeNull();
    expect(input.description).toBe('Un classique de la SF.');
  });

  it('sends coverImageUrl: null when the existing cover is removed', async () => {
    const view = await openEdit();
    await next(view);
    await next(view);
    await waitFor(() => expect(view.getByLabelText('Retirer la couverture')).toBeTruthy());
    await fireEvent.press(view.getByLabelText('Retirer la couverture'));

    const input = await save(view);

    expect(input.coverImageUrl).toBeNull();
    // Couverture d'origine (pas téléversée pendant cette session) : jamais supprimée
    // côté stockage dans ce lot.
    expect(mockApiClient.uploads.remove).not.toHaveBeenCalled();
  });

  it('keeps the barcode behaviour: an emptied barcode is still sent as null', async () => {
    const view = await openEdit();
    await fireEvent.changeText(view.getByLabelText('Code-barres'), '');
    await next(view);
    await next(view);

    const input = await save(view);

    expect(input.barcode).toBeNull();
    expect(input.description).toBe('Un classique de la SF.');
  });
});

describe('ItemFormScreen — hiérarchie et identité visuelle (Lot 3)', () => {
  const SAM = {
    id: 'member-2',
    role: 'MEMBER' as const,
    joinedAt: '2026-01-01T00:00:00.000Z',
    user: { ...MEMBER.user, id: 'user-2', email: 'sam@example.com', displayName: 'Sam' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetPreventRemoveMock();
    (mockApiClient.households.listMembers as jest.Mock).mockResolvedValue([MEMBER, SAM]);
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(EXISTING_ITEM);
    (mockApiClient.items.update as jest.Mock).mockResolvedValue({ ...EXISTING_ITEM });
    (mockApiClient.items.create as jest.Mock).mockResolvedValue({ id: 'item-1' });
  });

  type View = Awaited<ReturnType<typeof renderScreen>>;

  function styleOf(element: { props: { style?: unknown } }): ViewStyle {
    return StyleSheet.flatten(element.props.style as never) as ViewStyle;
  }

  function checked(view: View, name: string): boolean {
    return Boolean(view.getByRole('checkbox', { name }).props.accessibilityState?.checked);
  }

  async function toStep(view: View, label: string) {
    await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
    await waitFor(() => expect(view.getByLabelText(label)).toBeTruthy());
  }

  describe('owners', () => {
    it('create: preselects the current user as owner — no tap needed — and sends it', async () => {
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
      await waitFor(() => expect(view.getByLabelText('Titre')).toBeTruthy());
      await fireEvent.changeText(view.getByLabelText('Titre'), 'Dune');
      await toStep(view, 'Étape 2 sur 3, Votre exemplaire');
      await toStep(view, 'Étape 3 sur 3, Dans votre nid');

      expect(checked(view, 'Alix')).toBe(true);
      expect(checked(view, 'Sam')).toBe(false);
      expect(view.getByRole('header', { name: 'À qui appartient-il ?' })).toBeTruthy();

      await fireEvent.press(view.getByRole('button', { name: 'Ajouter au nid' }));
      await waitFor(() =>
        expect(mockApiClient.items.create).toHaveBeenCalledWith(
          'household-1',
          expect.objectContaining({ ownerIds: ['user-1'] }),
        ),
      );
    });

    it('create: never overrides an owner selection already carried by the draft (even empty)', async () => {
      const view = await renderScreen(
        <ItemFormScreen
          mode="create"
          category={BOOK_CATEGORY}
          initialValues={{ title: 'Dune', ownerIds: [] }}
        />,
      );
      await waitFor(() => expect(view.getByLabelText('Titre')).toBeTruthy());
      await toStep(view, 'Étape 2 sur 3, Votre exemplaire');
      await toStep(view, 'Étape 3 sur 3, Dans votre nid');

      expect(checked(view, 'Alix')).toBe(false);
    });

    it('edit: keeps exactly the existing owners — the current user is never added', async () => {
      (mockApiClient.items.get as jest.Mock).mockResolvedValue({
        ...EXISTING_ITEM,
        owners: [SAM.user],
      });
      const view = await renderScreen(
        <ItemFormScreen mode="edit" itemId="item-1" category={BOOK_CATEGORY} />,
      );
      await waitFor(() => expect(view.getByLabelText('Titre').props.value).toBe('Dune'));
      await toStep(view, 'Étape 2 sur 3, Votre exemplaire');
      await toStep(view, 'Étape 3 sur 3, Dans votre nid');

      expect(checked(view, 'Sam')).toBe(true);
      expect(checked(view, 'Alix')).toBe(false);

      await fireEvent.press(view.getByRole('button', { name: 'Enregistrer' }));
      await waitFor(() =>
        expect(mockApiClient.items.update).toHaveBeenCalledWith(
          'household-1',
          'item-1',
          expect.objectContaining({ ownerIds: ['user-2'] }),
        ),
      );
    });

    it('exposes each owner as a checkbox tall enough to tap', async () => {
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
      await waitFor(() => expect(view.getByLabelText('Titre')).toBeTruthy());
      await fireEvent.changeText(view.getByLabelText('Titre'), 'Dune');
      await toStep(view, 'Étape 2 sur 3, Votre exemplaire');
      await toStep(view, 'Étape 3 sur 3, Dans votre nid');

      const chip = view.getByRole('checkbox', { name: 'Sam' });
      expect(styleOf(chip).minHeight).toBeGreaterThanOrEqual(44);
      await fireEvent.press(chip);
      expect(checked(view, 'Sam')).toBe(true);
    });
  });

  describe('edit: save from any step', () => {
    it('shows "Enregistrer" on every step, next to "Suivant" until the last one', async () => {
      const view = await renderScreen(
        <ItemFormScreen mode="edit" itemId="item-1" category={BOOK_CATEGORY} />,
      );
      await waitFor(() => expect(view.getByLabelText('Titre').props.value).toBe('Dune'));
      // Le titre de l'objet retouché reste visible sous « Modifier l'objet ».
      expect(view.getByText("Modifier l'objet")).toBeTruthy();
      expect(view.getAllByText('Dune').length).toBeGreaterThan(0);

      expect(view.getByRole('button', { name: 'Enregistrer' })).toBeTruthy();
      await toStep(view, 'Étape 2 sur 3, Votre exemplaire');
      expect(view.getByRole('button', { name: 'Enregistrer' })).toBeTruthy();
      await toStep(view, 'Étape 3 sur 3, Dans votre nid');
      expect(view.getByRole('button', { name: 'Enregistrer' })).toBeTruthy();
      expect(view.queryByRole('button', { name: 'Suivant' })).toBeNull();
    });

    it('saves directly from step 1', async () => {
      const view = await renderScreen(
        <ItemFormScreen mode="edit" itemId="item-1" category={BOOK_CATEGORY} />,
      );
      await waitFor(() => expect(view.getByLabelText('Titre').props.value).toBe('Dune'));
      await fireEvent.changeText(view.getByLabelText('Titre'), 'Dune (poche)');

      await fireEvent.press(view.getByRole('button', { name: 'Enregistrer' }));

      await waitFor(() =>
        expect(mockApiClient.items.update).toHaveBeenCalledWith(
          'household-1',
          'item-1',
          expect.objectContaining({ title: 'Dune (poche)', ownerIds: ['user-1'] }),
        ),
      );
      await waitFor(() => expect(mockRouterBack).toHaveBeenCalledTimes(1));
    });

    it('saves directly from step 2 (e.g. only the notes)', async () => {
      const view = await renderScreen(
        <ItemFormScreen mode="edit" itemId="item-1" category={BOOK_CATEGORY} />,
      );
      await waitFor(() => expect(view.getByLabelText('Titre').props.value).toBe('Dune'));
      await toStep(view, 'Étape 2 sur 3, Votre exemplaire');
      await fireEvent.changeText(view.getByLabelText('Notes'), 'Prêté à Sam');

      await fireEvent.press(view.getByRole('button', { name: 'Enregistrer' }));

      await waitFor(() =>
        expect(mockApiClient.items.update).toHaveBeenCalledWith(
          'household-1',
          'item-1',
          expect.objectContaining({ notes: 'Prêté à Sam' }),
        ),
      );
    });

    it('keeps "Enregistrer" in forest green and "Suivant" secondary (ghost) in edit mode', async () => {
      const view = await renderScreen(
        <ItemFormScreen mode="edit" itemId="item-1" category={BOOK_CATEGORY} />,
      );
      await waitFor(() => expect(view.getByLabelText('Titre').props.value).toBe('Dune'));

      expect(styleOf(view.getByRole('button', { name: 'Enregistrer' })).backgroundColor).toBe(
        colors.primary,
      );
      expect(styleOf(view.getByRole('button', { name: 'Suivant' })).backgroundColor).toBe(
        'transparent',
      );
    });
  });

  describe('create CTA', () => {
    it('shows "Ajouter au nid" (terracotta) only on the last step, "Suivant" (forest green) before', async () => {
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
      await waitFor(() => expect(view.getByLabelText('Titre')).toBeTruthy());

      expect(view.queryByRole('button', { name: 'Ajouter au nid' })).toBeNull();
      expect(styleOf(view.getByRole('button', { name: 'Suivant' })).backgroundColor).toBe(
        colors.primary,
      );

      await fireEvent.changeText(view.getByLabelText('Titre'), 'Dune');
      await toStep(view, 'Étape 2 sur 3, Votre exemplaire');
      expect(view.queryByRole('button', { name: 'Ajouter au nid' })).toBeNull();
      expect(view.queryByRole('button', { name: 'Enregistrer' })).toBeNull();

      await toStep(view, 'Étape 3 sur 3, Dans votre nid');
      expect(styleOf(view.getByRole('button', { name: 'Ajouter au nid' })).backgroundColor).toBe(
        colors.secondary,
      );
    });
  });

  describe('step 1 hierarchy', () => {
    it('says clearly that only the title is required, and groups the work and its identifiers', async () => {
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
      await waitFor(() => expect(view.getByLabelText('Titre')).toBeTruthy());

      expect(view.getByText('Seul le titre est indispensable.')).toBeTruthy();
      expect(view.getByRole('header', { name: 'L’œuvre' })).toBeTruthy();
      expect(view.getByRole('header', { name: 'Identifiants' })).toBeTruthy();
      expect(view.getByText('Souvent identique à l’ISBN, mais pas toujours.')).toBeTruthy();
    });

    it('shows the category as a pill tinted like the Home tiles, with a large enough "Changer" target', async () => {
      const view = await renderScreen(
        <ItemFormScreen mode="create" category={CD_CATEGORY} onChangeCategoryPress={jest.fn()} />,
      );
      await waitFor(() => expect(view.getByTestId('category-pill')).toBeTruthy());

      expect(styleOf(view.getByTestId('category-pill')).backgroundColor).toBe(colors.tintPeach);
      expect(styleOf(view.getByLabelText('Changer de catégorie')).minHeight).toBeGreaterThanOrEqual(
        44,
      );
    });

    it.each([
      [BOOK_CATEGORY, 'Format', 'Poche, broché, relié…'],
      [BOOK_CATEGORY, 'Langue', 'Français, anglais…'],
      [CD_CATEGORY, 'Format', 'CD, vinyle…'],
      [DVD_CATEGORY, 'Format', 'DVD, Blu-ray…'],
      [DVD_CATEGORY, 'Région', 'Zone 2'],
      [DVD_CATEGORY, 'Édition', 'Collector, Steelbook…'],
    ])('%# shows a helpful placeholder for %s → %s', async (category, label, placeholder) => {
      const view = await renderScreen(<ItemFormScreen mode="create" category={category} />);
      await waitFor(() => expect(view.getByLabelText(label)).toBeTruthy());

      expect(view.getByLabelText(label).props.placeholder).toBe(placeholder);
    });
  });

  describe('progress', () => {
    it('shows done / current / upcoming states and announces the current step', async () => {
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
      await waitFor(() => expect(view.getByLabelText('Titre')).toBeTruthy());
      expect(view.getByRole('header', { name: "Étape 1 sur 3, L'objet" })).toBeTruthy();

      await fireEvent.changeText(view.getByLabelText('Titre'), 'Dune');
      await toStep(view, 'Étape 2 sur 3, Votre exemplaire');

      expect(styleOf(view.getByTestId('step-marker-0')).backgroundColor).toBe(colors.primary);
      expect(styleOf(view.getByTestId('step-marker-1')).backgroundColor).toBe(colors.secondary);
      expect(styleOf(view.getByTestId('step-marker-2')).backgroundColor).toBe(colors.surface);
      expect(styleOf(view.getByTestId('step-marker-2')).borderWidth).toBeGreaterThan(0);
    });
  });

  describe('warm surfaces', () => {
    it('renders the summary on a pale sage surface and the partial banner on honey', async () => {
      const view = await renderScreen(
        <ItemFormScreen mode="create" category={DVD_CATEGORY} infoMessage="À vérifier." />,
      );
      await waitFor(() => expect(view.getByTestId('item-form-info-banner')).toBeTruthy());
      expect(styleOf(view.getByTestId('item-form-info-banner')).backgroundColor).toBe(
        colors.tintHoney,
      );

      // Le bandeau s'affiche AVANT le chargement des membres (squelette à la place des
      // champs) : attendre le champ lui-même, jamais un signal rendu plus tôt que lui.
      await waitFor(() => expect(view.getByLabelText('Titre')).toBeTruthy());
      await fireEvent.changeText(view.getByLabelText('Titre'), 'Heat');
      await toStep(view, 'Étape 2 sur 3, Votre exemplaire');
      await toStep(view, 'Étape 3 sur 3, Dans votre nid');

      expect(styleOf(view.getByTestId('item-form-summary')).backgroundColor).toBe(colors.tintSage);
      expect(styleOf(view.getByTestId('cover-picker')).backgroundColor).toBe(colors.tintHoney);
    });
  });

  describe('rating', () => {
    it('shows the selected rating as text and offers an explicit "Retirer la note"', async () => {
      const view = await renderScreen(<ItemFormScreen mode="create" category={BOOK_CATEGORY} />);
      await waitFor(() => expect(view.getByLabelText('Titre')).toBeTruthy());
      await fireEvent.changeText(view.getByLabelText('Titre'), 'Dune');
      await toStep(view, 'Étape 2 sur 3, Votre exemplaire');

      expect(view.queryByRole('button', { name: 'Retirer la note' })).toBeNull();
      await fireEvent.press(view.getByLabelText('3,5 sur 5'));
      expect(view.getByTestId('rating-value').props.children).toEqual(['3,5', ' / 5']);

      await fireEvent.press(view.getByRole('button', { name: 'Retirer la note' }));
      expect(view.queryByTestId('rating-value')).toBeNull();
    });
  });
});
