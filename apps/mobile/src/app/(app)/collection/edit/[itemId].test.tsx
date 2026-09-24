import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ThemeProvider } from '../../../../theme';
import { mockItem } from '../../../../test-utils/mockItem';

import EditItemScreen from './[itemId]';

// La logique du formulaire (étapes, validation, soumission) est déjà couverte par
// ItemFormScreen.test.tsx — ce wrapper ne teste que ce qu'il ajoute lui-même : la
// dérivation de `category` depuis l'item chargé, et les états loading/erreur.
const mockItemFormScreen = jest.fn();
jest.mock('../../../../screens/item-form/ItemFormScreen', () => ({
  ItemFormScreen: (props: unknown) => {
    mockItemFormScreen(props);
    return null;
  },
}));

// expo-image's module-level analytics-integration probing isn't compatible with
// this jest environment; the components barrel pulls it in via ItemCard even
// though this screen never renders one (same as collection/[itemId].test.tsx).
jest.mock('expo-image', () => ({ Image: () => null }));

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockApiClient = {
  items: { get: jest.fn() },
} as unknown as import('@notre-nid/api-client').ApiClient;

jest.mock('../../../../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('../../../../providers/HouseholdProvider', () => ({
  useHousehold: () => ({ householdId: 'household-1' }),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ itemId: 'item-1' }),
}));

function renderScreen(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider fontsLoaded={false}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('EditItemScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loading skeleton while the item is being fetched, without rendering the form yet', async () => {
    (mockApiClient.items.get as jest.Mock).mockReturnValue(new Promise(() => {}));
    const view = await renderScreen(<EditItemScreen />);

    expect(view.toJSON()).toBeTruthy();
    expect(mockItemFormScreen).not.toHaveBeenCalled();
  });

  it('derives the category from the loaded item and renders ItemFormScreen in edit mode', async () => {
    const cdCategory = {
      id: 'category-cd',
      householdId: null,
      name: 'CD',
      slug: 'cd',
      icon: null,
      isSystem: true,
      metadataSchema: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    (mockApiClient.items.get as jest.Mock).mockResolvedValue(
      mockItem({
        category: cdCategory,
        book: null,
        cd: { itemId: 'item-1', artist: 'Daft Punk', releaseYear: 2001, label: null, format: null },
      }),
    );

    await renderScreen(<EditItemScreen />);

    await waitFor(() => expect(mockItemFormScreen).toHaveBeenCalled());
    expect(mockItemFormScreen).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'edit', itemId: 'item-1', category: cdCategory }),
    );
  });

  it('shows an error state instead of the form when the item request fails', async () => {
    (mockApiClient.items.get as jest.Mock).mockRejectedValue(new Error('boom'));
    const view = await renderScreen(<EditItemScreen />);

    await waitFor(() => expect(view.getByText('Objet introuvable')).toBeTruthy());
    expect(view.getByText("Une erreur inattendue s'est produite.")).toBeTruthy();
    expect(mockItemFormScreen).not.toHaveBeenCalled();
  });
});
