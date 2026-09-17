import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ThemeProvider } from '../../../theme';

import AddItemCategoryScreen from './category';

jest.mock('expo-image', () => ({ Image: () => null }));

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

const mockApiClient = {
  categories: { list: jest.fn() },
} as unknown as import('@notre-nid/api-client').ApiClient;

jest.mock('../../../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('../../../providers/HouseholdProvider', () => ({
  useHousehold: () => ({ householdId: 'household-1' }),
}));

const BOOK = {
  id: 'cat-book',
  householdId: null,
  name: 'Livres',
  slug: 'book',
  icon: null,
  isSystem: true,
  metadataSchema: null,
  createdAt: '',
  updatedAt: '',
};
const CD = { ...BOOK, id: 'cat-cd', slug: 'cd', name: 'CD' };
const DVD = { ...BOOK, id: 'cat-dvd', slug: 'dvd', name: 'DVD' };
const CUSTOM = {
  ...BOOK,
  id: 'cat-custom',
  slug: 'board-games',
  name: 'Jeux de société',
  isSystem: false,
  householdId: 'household-1',
};

function renderScreen(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider fontsLoaded={false}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('AddItemCategoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists book, cd and dvd, excluding a custom category even if the API returns one', async () => {
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([BOOK, CD, DVD, CUSTOM]);
    const view = await renderScreen(<AddItemCategoryScreen />);

    await waitFor(() => expect(view.getByText('Livres')).toBeTruthy());
    expect(view.getByText('CD')).toBeTruthy();
    expect(view.getByText('DVD')).toBeTruthy();
    expect(view.queryByText('Jeux de société')).toBeNull();
  });

  it('navigates to the mode screen with the chosen categoryId', async () => {
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([BOOK, CD, DVD]);
    const view = await renderScreen(<AddItemCategoryScreen />);

    await waitFor(() => expect(view.getByText('CD')).toBeTruthy());
    await fireEvent.press(view.getByText('CD'));

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/(app)/add-item/mode',
      params: { categoryId: 'cat-cd' },
    });
  });

  // Le bouton retour de cet écran est désormais l'écran-retour natif automatique
  // d'expo-router (hérité du Stack parent `(app)`, voir le commentaire dans
  // category.tsx) — comme pour mode/scan/form, collection/[itemId] et Profil, aucun
  // rendu custom n'existe plus ici. Ce mécanisme est purement natif (react-native-screens)
  // et n'est pas exerçable par ces tests Jest, qui mockent entièrement `expo-router` :
  // sa vérification (présence, taille, retour effectif) reste un test manuel Android/iOS.
});
