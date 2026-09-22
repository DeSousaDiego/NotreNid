import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { createElement, useCallback, useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

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

// `CameraView` est capturé à chaque rendu (`mockLatestCameraProps`) pour que
// les tests puissent déclencher `onBarcodeScanned` directement, comme le
// ferait le module natif — sans dépendre d'une vraie caméra. `useCameraPermissions`
// est un vrai petit hook (`useState`/`useCallback`) plutôt qu'une valeur figée :
// `requestPermission` doit réellement re-rendre le composant avec le nouveau
// statut, exactement comme le hook réel d'expo-camera. Les deux mocks sont des
// déclarations `function` (pas `const`) : `jest.mock` est hissé au-dessus de
// TOUT le corps du fichier (babel-plugin-jest-hoist), y compris au-dessus d'un
// `const`, alors qu'une déclaration `function` l'est aussi — seule une
// `function` garantit que sa factory (exécutée dès le premier `require` de
// `expo-camera`, potentiellement avant le reste de ce fichier) trouve une
// valeur déjà définie. Référencées depuis la factory, elles doivent aussi
// commencer par `mock` (même contrainte de hissage) — `mockUseCameraPermissions`
// appelle donc de vrais hooks sans porter un nom de hook valide pour ESLint ;
// la règle ne s'applique qu'à du code d'app réel, pas à ce double de test.
type MockPermission = { status: string; granted: boolean; canAskAgain: boolean; expires: 'never' };
let mockPermissionResponse: MockPermission = {
  status: 'granted',
  granted: true,
  canAskAgain: true,
  expires: 'never',
};
type MockCameraProps = {
  onBarcodeScanned?: (result: { data: string; type: string }) => void;
} | null;
let mockLatestCameraProps: MockCameraProps = null;
const mockRequestPermissionImpl = jest.fn(async () => mockPermissionResponse);

function mockCameraView(props: MockCameraProps) {
  mockLatestCameraProps = props;
  return createElement(View, { testID: 'barcode-camera' });
}

/* eslint-disable react-hooks/rules-of-hooks -- double de test pour `useCameraPermissions`, pas un hook applicatif (voir commentaire ci-dessus) */
function mockUseCameraPermissions(): [MockPermission, () => Promise<MockPermission>] {
  const [state, setState] = useState(() => mockPermissionResponse);
  const request = useCallback(async () => {
    const next = await mockRequestPermissionImpl();
    setState(next);
    return next;
  }, []);
  return [state, request];
}
/* eslint-enable react-hooks/rules-of-hooks */

jest.mock('expo-camera', () => ({
  CameraView: mockCameraView,
  useCameraPermissions: mockUseCameraPermissions,
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
const DVD_CATEGORY = { ...BOOK_CATEGORY, id: 'cat-dvd', slug: 'dvd', name: 'DVD' };

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

const MATCHED_DVD_RESULT = {
  barcode: '883929005559',
  category: 'dvd',
  status: 'matched',
  match: true,
  source: 'upcitemdb',
  data: {
    title: 'The Dark Knight : Le Chevalier Noir',
    description: 'Batman affronte le Joker à Gotham.',
    book: null,
    cd: null,
    dvd: {
      director: 'Christopher Nolan',
      releaseYear: 2008,
      duration: 152,
      edition: 'Édition Collector',
      region: 'Zone 2',
      format: 'Blu-ray',
    },
    countryCodes: ['US', 'GB'],
  },
  cover: { url: 'https://example.test/dark-knight-cover.jpg' },
};

// Coffret multi-films : UPCitemdb identifie bien un produit vidéo, mais TMDB
// ne trouve aucun candidat assez confiant (voir DvdEnrichmentService) — statut
// `partial`, seules les données UPCitemdb (fiables) sont préremplies.
const PARTIAL_DVD_RESULT = {
  barcode: '883929005560',
  category: 'dvd',
  status: 'partial',
  match: false,
  source: 'upcitemdb',
  data: {
    title: 'Coffret Trilogie Mystère',
    description: null,
    book: null,
    cd: null,
    dvd: {
      director: null,
      releaseYear: null,
      duration: null,
      edition: 'Coffret',
      region: 'Zone 2',
      format: 'DVD',
    },
    countryCodes: null,
  },
  cover: { url: 'https://example.test/coffret-cover.jpg' },
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

function tree(draftRef: { current: AddItemDraft | null }, seed?: Partial<ItemFormValues>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider fontsLoaded={false}>
        <Harness draftRef={draftRef} seed={seed} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

async function renderScreen(seed?: Partial<ItemFormValues>) {
  const draftRef: { current: AddItemDraft | null } = { current: null };
  const view = await render(tree(draftRef, seed));
  return { view, draftRef };
}

/** Simule une détection caméra réelle : attend que `CameraView` soit monté et
 * scanne, puis invoque directement `onBarcodeScanned` — exactement l'appel
 * que ferait le module natif. */
async function scanBarcode(code: string, type = 'ean13') {
  await waitFor(() => expect(mockLatestCameraProps?.onBarcodeScanned).toBeTruthy());
  await act(async () => {
    mockLatestCameraProps!.onBarcodeScanned!({ data: code, type });
  });
}

describe('AddItemScanScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentCategoryId = 'cat-book';
    mockLatestCameraProps = null;
    mockPermissionResponse = {
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    };
    mockRequestPermissionImpl.mockImplementation(async () => mockPermissionResponse);
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([
      BOOK_CATEGORY,
      CD_CATEGORY,
      DVD_CATEGORY,
    ]);
  });

  it('renders the camera preview with scan instructions and the manual fallback', async () => {
    const { view } = await renderScreen();
    await waitFor(() => expect(view.getByTestId('barcode-camera')).toBeTruthy());
    expect(view.getByText('Placez le code-barres dans le cadre')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Saisir manuellement à la place' })).toBeTruthy();
  });

  it('a single scan triggers exactly one resolveBarcode call', async () => {
    (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue(MATCHED_RESULT);
    await renderScreen();

    await scanBarcode('9782070368228');

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled());
    expect(mockApiClient.items.resolveBarcode).toHaveBeenCalledTimes(1);
    expect(mockApiClient.items.resolveBarcode).toHaveBeenCalledWith({
      barcode: '9782070368228',
      category: 'book',
    });
  });

  it('a duplicate native callback for the same code never triggers a second resolve call', async () => {
    let resolveLookup!: (value: unknown) => void;
    (mockApiClient.items.resolveBarcode as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveLookup = resolve;
      }),
    );
    await renderScreen();

    await waitFor(() => expect(mockLatestCameraProps?.onBarcodeScanned).toBeTruthy());
    const onScanned = mockLatestCameraProps!.onBarcodeScanned!;
    // Deux appels synchrones de la MÊME fonction capturée — simule le module
    // natif qui invoque le callback deux fois avant que React n'ait eu la
    // chance de re-rendre avec la prop désactivée.
    await act(async () => {
      onScanned({ data: '9782070368228', type: 'ean13' });
      onScanned({ data: '9782070368228', type: 'ean13' });
    });

    resolveLookup({ ...MATCHED_RESULT });
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled());
    expect(mockApiClient.items.resolveBarcode).toHaveBeenCalledTimes(1);
  });

  it('shows a loading state while the search is in flight, keeping the camera preview mounted but locked', async () => {
    let resolveLookup!: (value: unknown) => void;
    (mockApiClient.items.resolveBarcode as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveLookup = resolve;
      }),
    );
    const { view } = await renderScreen();

    await scanBarcode('9782070368228');

    await waitFor(() => expect(view.getByText('Recherche des informations…')).toBeTruthy());
    expect(view.getByTestId('barcode-camera')).toBeTruthy();
    expect(mockLatestCameraProps?.onBarcodeScanned).toBeUndefined();

    resolveLookup({ ...MATCHED_RESULT });
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled());
  });

  it('shows a clean message and does not navigate when nothing matches, offering a rescan', async () => {
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

    await scanBarcode('9782070368228');

    await waitFor(() => expect(view.getByText(/Aucun résultat pour ce code-barres/)).toBeTruthy());
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(view.getByRole('button', { name: 'Scanner à nouveau' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Saisir manuellement à la place' })).toBeTruthy();
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

    await scanBarcode('036000291452');

    await waitFor(() =>
      expect(view.getByText(/n’est pas encore disponible pour cette catégorie/)).toBeTruthy(),
    );
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('shows a distinct message and a retry option when every external provider failed (provider_error)', async () => {
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

    await scanBarcode('9782070368228');

    await waitFor(() => expect(view.getByText(/momentanément indisponible/)).toBeTruthy());
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(view.getByRole('button', { name: 'Scanner à nouveau' })).toBeTruthy();
  });

  it('shows an error message when the request itself fails (network/API error)', async () => {
    (mockApiClient.items.resolveBarcode as jest.Mock).mockRejectedValue(new Error('Hors ligne.'));
    const { view } = await renderScreen();

    await scanBarcode('9782070368228');

    await waitFor(() =>
      expect(view.getByText("Une erreur inattendue s'est produite.")).toBeTruthy(),
    );
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('resets the scan lock after "Scanner à nouveau" — a fresh scan resolves again', async () => {
    (mockApiClient.items.resolveBarcode as jest.Mock)
      .mockResolvedValueOnce({
        barcode: '9782070368228',
        category: 'book',
        status: 'no_match',
        match: false,
        source: null,
        data: null,
        cover: null,
      })
      .mockResolvedValueOnce(MATCHED_RESULT);
    const { view } = await renderScreen();

    await scanBarcode('9782070368228');
    await waitFor(() => expect(view.getByText(/Aucun résultat pour ce code-barres/)).toBeTruthy());

    await fireEvent.press(view.getByRole('button', { name: 'Scanner à nouveau' }));
    await waitFor(() => expect(view.getByTestId('barcode-camera')).toBeTruthy());
    expect(view.queryByText(/Aucun résultat pour ce code-barres/)).toBeNull();

    await scanBarcode('9782070368228');
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled());
    expect(mockApiClient.items.resolveBarcode).toHaveBeenCalledTimes(2);
  });

  it('changing category mid-session discards any previous scan state', async () => {
    (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue({
      barcode: '9782070368228',
      category: 'book',
      status: 'no_match',
      match: false,
      source: null,
      data: null,
      cover: null,
    });
    const draftRef: { current: AddItemDraft | null } = { current: null };
    const view = await render(tree(draftRef));

    await waitFor(() => expect(mockLatestCameraProps?.onBarcodeScanned).toBeTruthy());
    await act(async () => {
      mockLatestCameraProps!.onBarcodeScanned!({ data: '9782070368228', type: 'ean13' });
    });
    await waitFor(() => expect(view.getByText(/Aucun résultat pour ce code-barres/)).toBeTruthy());

    mockCurrentCategoryId = 'cat-cd';
    await view.rerender(tree(draftRef));

    await waitFor(() => expect(view.queryByText(/Aucun résultat pour ce code-barres/)).toBeNull());
    expect(view.getByTestId('barcode-camera')).toBeTruthy();
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

  it('on success, prefills the draft with objective fields only and navigates to the form', async () => {
    (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue(MATCHED_RESULT);
    const { draftRef } = await renderScreen();

    await scanBarcode('9782070368228');

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
    const { draftRef } = await renderScreen();

    await scanBarcode('9782070368228');
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled());

    expect(draftRef.current?.values).not.toHaveProperty('condition');
    expect(draftRef.current?.values).not.toHaveProperty('rating');
    expect(draftRef.current?.values).not.toHaveProperty('notes');
    expect(draftRef.current?.values).not.toHaveProperty('ownerIds');
  });

  it('a scan result never overwrites unrelated fields already present in the draft', async () => {
    (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue(MATCHED_RESULT);
    const { draftRef } = await renderScreen({
      ownerIds: ['user-1'],
      metadata: { publisher: 'Déjà saisi à la main' },
    });

    await scanBarcode('9782070368228');
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled());

    // `ownerIds` (hors de `metadata`) reste intact ; `metadata.publisher` est écrasé
    // par la valeur du scan (même clé) — comportement attendu, seule une clé absente
    // du résultat du scan doit être préservée.
    expect(draftRef.current?.values?.ownerIds).toEqual(['user-1']);
    expect(draftRef.current?.values?.metadata).toMatchObject({ publisher: 'Gallimard' });
  });

  describe('permission handling', () => {
    it('automatically requests camera permission on first access', async () => {
      mockPermissionResponse = {
        status: 'undetermined',
        granted: false,
        canAskAgain: true,
        expires: 'never',
      };
      mockRequestPermissionImpl.mockImplementationOnce(async () => ({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      }));
      const { view } = await renderScreen();

      await waitFor(() => expect(mockRequestPermissionImpl).toHaveBeenCalled());
      await waitFor(() => expect(view.getByTestId('barcode-camera')).toBeTruthy());
    });

    it('shows an explanation and a retry button when permission is denied but can be asked again', async () => {
      mockPermissionResponse = {
        status: 'denied',
        granted: false,
        canAskAgain: true,
        expires: 'never',
      };
      const { view } = await renderScreen();

      await waitFor(() =>
        expect(view.getByRole('button', { name: 'Autoriser l’accès à la caméra' })).toBeTruthy(),
      );
      expect(view.getByRole('button', { name: 'Saisir manuellement à la place' })).toBeTruthy();

      await fireEvent.press(view.getByRole('button', { name: 'Autoriser l’accès à la caméra' }));
      expect(mockRequestPermissionImpl).toHaveBeenCalled();
    });

    it('directs to Settings when permission is permanently denied, keeping manual entry available', async () => {
      mockPermissionResponse = {
        status: 'denied',
        granted: false,
        canAskAgain: false,
        expires: 'never',
      };
      const openSettingsSpy = jest
        .spyOn(Linking, 'openSettings')
        .mockImplementation(() => Promise.resolve());
      const { view } = await renderScreen();

      await waitFor(() =>
        expect(view.getByRole('button', { name: 'Ouvrir les réglages' })).toBeTruthy(),
      );
      expect(view.getByRole('button', { name: 'Saisir manuellement à la place' })).toBeTruthy();

      await fireEvent.press(view.getByRole('button', { name: 'Ouvrir les réglages' }));
      expect(openSettingsSpy).toHaveBeenCalled();

      openSettingsSpy.mockRestore();
    });
  });

  describe('cd', () => {
    beforeEach(() => {
      mockCurrentCategoryId = 'cat-cd';
    });

    it('on success, prefills the draft with title, artist, year, label, format and cover', async () => {
      (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue(MATCHED_CD_RESULT);
      const { draftRef } = await renderScreen();

      await scanBarcode('5099969236424');

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
      const { draftRef } = await renderScreen();

      await scanBarcode('5099969236424');
      await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled());

      expect(draftRef.current?.values?.countryCodes).toEqual(['FR']);
    });

    it('never prefills condition, rating, notes or ownerIds for a cd scan either', async () => {
      (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue(MATCHED_CD_RESULT);
      const { draftRef } = await renderScreen();

      await scanBarcode('5099969236424');
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
      const { draftRef } = await renderScreen();

      await scanBarcode('5099969236424');
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

      await scanBarcode('5099969236424');

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

      await scanBarcode('5099969236424');

      await waitFor(() => expect(view.getByText(/momentanément indisponible/)).toBeTruthy());
      expect(mockRouterReplace).not.toHaveBeenCalled();
    });
  });

  describe('dvd', () => {
    beforeEach(() => {
      mockCurrentCategoryId = 'cat-dvd';
    });

    it('on a full match (UPC + TMDB), prefills title, description, cover and every dvd field', async () => {
      (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue(MATCHED_DVD_RESULT);
      const { draftRef } = await renderScreen();

      await scanBarcode('883929005559', 'upc_a');

      await waitFor(() =>
        expect(mockRouterReplace).toHaveBeenCalledWith({
          pathname: '/(app)/add-item/form',
          params: { categoryId: 'cat-dvd' },
        }),
      );

      expect(draftRef.current?.values).toEqual({
        barcode: '883929005559',
        title: 'The Dark Knight : Le Chevalier Noir',
        description: 'Batman affronte le Joker à Gotham.',
        coverImageUrl: 'https://example.test/dark-knight-cover.jpg',
        countryCodes: ['US', 'GB'],
        metadata: {
          director: 'Christopher Nolan',
          releaseYear: '2008',
          durationMinutes: '152',
          edition: 'Édition Collector',
          region: 'Zone 2',
          format: 'Blu-ray',
        },
      });
      expect(draftRef.current?.partialWarning).toBe(false);
    });

    it('on a partial match (film not resolved by TMDB), prefills only the fields UPCitemdb actually returned and flags the draft as partial', async () => {
      (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue(PARTIAL_DVD_RESULT);
      const { draftRef } = await renderScreen();

      await scanBarcode('883929005560', 'upc_a');

      await waitFor(() =>
        expect(mockRouterReplace).toHaveBeenCalledWith({
          pathname: '/(app)/add-item/form',
          params: { categoryId: 'cat-dvd' },
        }),
      );

      // Jamais de director/releaseYear/durationMinutes ni de countryCodes : ces
      // champs sont exclusivement fournis par TMDB, non résolu ici.
      expect(draftRef.current?.values).toEqual({
        barcode: '883929005560',
        title: 'Coffret Trilogie Mystère',
        coverImageUrl: 'https://example.test/coffret-cover.jpg',
        metadata: {
          edition: 'Coffret',
          region: 'Zone 2',
          format: 'DVD',
        },
      });
      expect(draftRef.current?.values).not.toHaveProperty('countryCodes');
      expect(draftRef.current?.partialWarning).toBe(true);
    });

    it('never prefills condition, rating, notes or ownerIds for a dvd scan either', async () => {
      (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue(MATCHED_DVD_RESULT);
      const { draftRef } = await renderScreen();

      await scanBarcode('883929005559', 'upc_a');
      await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled());

      expect(draftRef.current?.values).not.toHaveProperty('condition');
      expect(draftRef.current?.values).not.toHaveProperty('rating');
      expect(draftRef.current?.values).not.toHaveProperty('notes');
      expect(draftRef.current?.values).not.toHaveProperty('ownerIds');
    });

    it('a partial match never overwrites unrelated fields already present in the draft', async () => {
      (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue(PARTIAL_DVD_RESULT);
      const { draftRef } = await renderScreen({
        ownerIds: ['user-1'],
        metadata: { format: 'Déjà saisi à la main' },
      });

      await scanBarcode('883929005560', 'upc_a');
      await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled());

      expect(draftRef.current?.values?.ownerIds).toEqual(['user-1']);
      expect(draftRef.current?.values?.metadata).toMatchObject({ format: 'DVD' });
    });

    it('shows a clean message and does not navigate when dvd search finds nothing', async () => {
      (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue({
        barcode: '883929005561',
        category: 'dvd',
        status: 'no_match',
        match: false,
        source: null,
        data: null,
        cover: null,
      });
      const { view } = await renderScreen();

      await scanBarcode('883929005561', 'upc_a');

      await waitFor(() =>
        expect(view.getByText(/Aucun résultat pour ce code-barres/)).toBeTruthy(),
      );
      expect(mockRouterReplace).not.toHaveBeenCalled();
    });

    it('dvd is no longer "unsupported" — a provider_error (UPC down) shows the same message as book/cd', async () => {
      (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue({
        barcode: '883929005559',
        category: 'dvd',
        status: 'provider_error',
        match: false,
        source: null,
        data: null,
        cover: null,
      });
      const { view } = await renderScreen();

      await scanBarcode('883929005559', 'upc_a');

      await waitFor(() => expect(view.getByText(/momentanément indisponible/)).toBeTruthy());
      expect(mockRouterReplace).not.toHaveBeenCalled();
    });

    // Les deux tests suivants reprennent EXACTEMENT les valeurs des fixtures
    // backend réellement capturées pendant le POC (voir
    // apps/api/src/items/barcode/test-fixtures/upcitemdb/ et
    // dvd-pipeline.integration.spec.ts) — mêmes barcodes, mêmes résultats
    // normalisés — pour tracer la chaîne complète fixture → résolveur →
    // contrat public → mobile, pas seulement des données synthétiques.

    it('scenario "9" (fixture backend réelle) : matched, formulaire DVD complet', async () => {
      const NINE_RESULT = {
        barcode: '065935831686',
        category: 'dvd',
        status: 'matched',
        match: true,
        source: 'upcitemdb',
        data: {
          title: '9',
          description:
            "Dans un futur post-apocalyptique, une poupée de tissu s'éveille et doit affronter les machines qui ont exterminé l'humanité.",
          book: null,
          cd: null,
          dvd: {
            director: 'Shane Acker',
            releaseYear: 2009,
            duration: 79,
            edition: null,
            region: null,
            format: null,
          },
          countryCodes: ['US'],
        },
        // Image UPC prioritaire, jamais le poster TMDB, quand elle est présente
        // (voir dvd-pipeline.integration.spec.ts).
        cover: { url: 'https://example-fixture.test/upcitemdb/nine-bluray-cover.jpg' },
      };
      (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue(NINE_RESULT);
      const { draftRef } = await renderScreen();

      await scanBarcode('065935831686', 'upc_a');
      await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled());

      expect(draftRef.current?.values).toEqual({
        barcode: '065935831686',
        title: '9',
        description:
          "Dans un futur post-apocalyptique, une poupée de tissu s'éveille et doit affronter les machines qui ont exterminé l'humanité.",
        coverImageUrl: 'https://example-fixture.test/upcitemdb/nine-bluray-cover.jpg',
        countryCodes: ['US'],
        metadata: { director: 'Shane Acker', releaseYear: '2009', durationMinutes: '79' },
      });
      expect(draftRef.current?.partialWarning).toBe(false);
    });

    it('scenario Dark Knight Trilogy (fixture backend réelle, coffret) : partial, uniquement les champs UPC sûrs, bandeau activé', async () => {
      const DARK_KNIGHT_TRILOGY_RESULT = {
        barcode: '883929308002',
        category: 'dvd',
        status: 'partial',
        match: false,
        source: 'upcitemdb',
        data: {
          title: 'The Dark Knight Trilogy',
          description: null,
          book: null,
          cd: null,
          dvd: {
            director: null,
            releaseYear: null,
            duration: null,
            edition: null,
            region: null,
            // Seul champ UPC sûr détecté pour ce coffret (voir
            // dvd-pipeline.integration.spec.ts) — jamais un champ TMDB.
            format: '6-Disc',
          },
          countryCodes: null,
        },
        cover: { url: 'https://example-fixture.test/upcitemdb/dark-knight-trilogy-cover.jpg' },
      };
      (mockApiClient.items.resolveBarcode as jest.Mock).mockResolvedValue(
        DARK_KNIGHT_TRILOGY_RESULT,
      );
      const { draftRef } = await renderScreen();

      await scanBarcode('883929308002', 'upc_a');
      await waitFor(() => expect(mockRouterReplace).toHaveBeenCalled());

      expect(draftRef.current?.values).toEqual({
        barcode: '883929308002',
        title: 'The Dark Knight Trilogy',
        coverImageUrl: 'https://example-fixture.test/upcitemdb/dark-knight-trilogy-cover.jpg',
        metadata: { format: '6-Disc' },
      });
      expect(draftRef.current?.values).not.toHaveProperty('countryCodes');
      expect(draftRef.current?.partialWarning).toBe(true);
    });
  });
});
