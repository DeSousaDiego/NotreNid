import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ToastProvider } from '../../../components';
import { ThemeProvider } from '../../../theme';

import CategoriesScreen from './categories';

// expo-image's module-level analytics-integration probing isn't compatible with
// this jest environment; the components barrel pulls it in via ItemCard even
// though this screen never renders one (see docs/PHASE_STATUS.md Phase 3B).
jest.mock('expo-image', () => ({ Image: () => null }));

const mockApiClient = createMockApiClient();

jest.mock('../../../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
}));

let mockCurrentRole: 'OWNER' | 'ADMIN' | 'MEMBER' = 'OWNER';

jest.mock('../../../providers/HouseholdProvider', () => ({
  useHousehold: () => ({
    householdId: 'household-1',
    households: [
      {
        id: 'household-1',
        name: 'Le Nid',
        createdById: 'user-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        role: mockCurrentRole,
      },
    ],
    isLoading: false,
    isError: false,
    selectHousehold: jest.fn(),
    clearSelection: jest.fn(),
    refetch: jest.fn(),
  }),
}));

function createMockApiClient() {
  return {
    categories: {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    },
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

const VINYL_CATEGORY = {
  id: 'category-vinyl',
  householdId: 'household-1',
  name: 'Vinyles',
  slug: 'vinyles',
  icon: null,
  isSystem: false,
  metadataSchema: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
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

describe('CategoriesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentRole = 'OWNER';
  });

  it('shows the empty state when the household has no categories', async () => {
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([]);
    const view = await renderScreen(<CategoriesScreen />);

    await waitFor(() => expect(view.getByText('Aucune catégorie')).toBeTruthy());
  });

  it('shows an error state and retries on demand', async () => {
    (mockApiClient.categories.list as jest.Mock).mockRejectedValue(new Error('boom'));
    const view = await renderScreen(<CategoriesScreen />);

    await waitFor(() =>
      expect(view.getByText("Une erreur inattendue s'est produite.")).toBeTruthy(),
    );

    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([BOOK_CATEGORY]);
    await fireEvent.press(view.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(view.getByText('Livre')).toBeTruthy());
    expect(mockApiClient.categories.list).toHaveBeenCalledTimes(2);
  });

  it('lists categories, distinguishing system from custom ones', async () => {
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([BOOK_CATEGORY, VINYL_CATEGORY]);
    const view = await renderScreen(<CategoriesScreen />);

    await waitFor(() => expect(view.getByText('Livre')).toBeTruthy());
    expect(view.getByText('Vinyles')).toBeTruthy();
    expect(view.getByText('Catégorie système')).toBeTruthy();
    expect(view.getByText('Catégorie personnalisée')).toBeTruthy();
  });

  it('hides edit/delete actions and the add button for a plain member', async () => {
    mockCurrentRole = 'MEMBER';
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([BOOK_CATEGORY, VINYL_CATEGORY]);
    const view = await renderScreen(<CategoriesScreen />);

    await waitFor(() => expect(view.getByText('Vinyles')).toBeTruthy());
    expect(view.queryByLabelText('Modifier Vinyles')).toBeNull();
    expect(view.queryByLabelText('Supprimer Vinyles')).toBeNull();
    expect(view.queryByText('Ajouter une catégorie')).toBeNull();
  });

  it('deletes a custom category after confirming the destructive dialog', async () => {
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([BOOK_CATEGORY, VINYL_CATEGORY]);
    (mockApiClient.categories.remove as jest.Mock).mockResolvedValue(undefined);
    const view = await renderScreen(<CategoriesScreen />);

    await waitFor(() => expect(view.getByText('Vinyles')).toBeTruthy());

    await fireEvent.press(view.getByLabelText('Supprimer Vinyles'));
    await waitFor(() => expect(view.getByText('Supprimer cette catégorie ?')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Supprimer' }));

    await waitFor(() =>
      expect(mockApiClient.categories.remove).toHaveBeenCalledWith('household-1', 'category-vinyl'),
    );
  });

  it('creates a new category with a custom field', async () => {
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([BOOK_CATEGORY]);
    (mockApiClient.categories.create as jest.Mock).mockResolvedValue({ id: 'category-new' });
    const view = await renderScreen(<CategoriesScreen />);

    await waitFor(() => expect(view.getByText('Ajouter une catégorie')).toBeTruthy());
    await fireEvent.press(view.getByText('Ajouter une catégorie'));

    await waitFor(() => expect(view.getByText('Nouvelle catégorie')).toBeTruthy());
    await fireEvent.changeText(view.getByLabelText('Nom'), 'Vinyles');
    await fireEvent.changeText(view.getByLabelText('Libellé du champ'), 'Format');
    await fireEvent.press(view.getByText('Ajouter ce champ'));

    await waitFor(() => expect(view.getByText('Format (Texte)')).toBeTruthy());

    await fireEvent.press(view.getByRole('button', { name: 'Créer' }));

    await waitFor(() =>
      expect(mockApiClient.categories.create).toHaveBeenCalledWith('household-1', {
        name: 'Vinyles',
        metadataSchema: [{ key: 'Format', label: 'Format', type: 'string', required: false }],
      }),
    );
  });

  it('requires a name before creating a category', async () => {
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([BOOK_CATEGORY]);
    const view = await renderScreen(<CategoriesScreen />);

    await waitFor(() => expect(view.getByText('Ajouter une catégorie')).toBeTruthy());
    await fireEvent.press(view.getByText('Ajouter une catégorie'));

    await waitFor(() => expect(view.getByText('Nouvelle catégorie')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Créer' }));

    await waitFor(() => expect(view.getByText('Le nom est requis.')).toBeTruthy());
    expect(mockApiClient.categories.create).not.toHaveBeenCalled();
  });

  it('edits an existing custom category', async () => {
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([VINYL_CATEGORY]);
    (mockApiClient.categories.update as jest.Mock).mockResolvedValue({ id: 'category-vinyl' });
    const view = await renderScreen(<CategoriesScreen />);

    await waitFor(() => expect(view.getByText('Vinyles')).toBeTruthy());
    await fireEvent.press(view.getByLabelText('Modifier Vinyles'));

    await waitFor(() => expect(view.getByText('Modifier la catégorie')).toBeTruthy());
    await fireEvent.changeText(view.getByLabelText('Nom'), 'Vinyles 33t');
    await fireEvent.press(view.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() =>
      expect(mockApiClient.categories.update).toHaveBeenCalledWith(
        'household-1',
        'category-vinyl',
        {
          name: 'Vinyles 33t',
          metadataSchema: [],
        },
      ),
    );
  });
});
