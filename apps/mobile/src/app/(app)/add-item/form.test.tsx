import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useEffect, type ReactNode } from 'react';

import { ToastProvider } from '../../../components';
import {
  AddItemDraftProvider,
  useAddItemDraft,
} from '../../../screens/add-item/AddItemDraftContext';
import type { ItemFormValues } from '../../../screens/item-form/schema';
import { ThemeProvider } from '../../../theme';

import AddItemFormScreen from './form';

jest.mock('expo-image', () => ({ Image: () => null }));

// `ItemFormScreen` lit `useSafeAreaInsets` directement pour son footer fixe — même
// convention que `collection/filters.test.tsx` (hook mocké, pas de vrai `SafeAreaProvider`).
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockRouterReplace = jest.fn();
const mockRouterDismissTo = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    dismissTo: (...args: unknown[]) => mockRouterDismissTo(...args),
  },
  useLocalSearchParams: () => ({ categoryId: 'cat-cd' }),
  useNavigation: () => ({ dispatch: jest.fn() }),
}));

jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (...args: [boolean, never]) =>
    jest.requireActual('../../../test-utils/preventRemoveMock').recordPreventRemove(...args),
}));

const mockApiClient = {
  categories: { list: jest.fn() },
  households: { listMembers: jest.fn() },
  items: { create: jest.fn() },
} as unknown as import('@notre-nid/api-client').ApiClient;

jest.mock('../../../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('../../../providers/HouseholdProvider', () => ({
  useHousehold: () => ({ householdId: 'household-1' }),
}));

const CD_CATEGORY = {
  id: 'cat-cd',
  householdId: null,
  name: 'CD',
  slug: 'cd',
  icon: null,
  isSystem: true,
  metadataSchema: null,
  createdAt: '',
  updatedAt: '',
};

const MEMBER = {
  id: 'member-1',
  role: 'OWNER' as const,
  joinedAt: '',
  user: {
    id: 'user-1',
    email: 'alix@example.com',
    displayName: 'Alix',
    avatarUrl: null,
    createdAt: '',
    updatedAt: '',
  },
};

/**
 * Reproduit l'arrivée depuis le scan : le brouillon (catégorie + valeurs) est déjà
 * rempli AVANT le montage du formulaire, qui ne lit ses valeurs initiales qu'une fois.
 */
function SeededDraft({ seed, children }: { seed: Partial<ItemFormValues>; children: ReactNode }) {
  const draft = useAddItemDraft();
  useEffect(() => {
    draft.setCategory('cat-cd');
    draft.setValues(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- amorçage unique au montage
  }, []);
  // Le formulaire ne se monte qu'une fois le brouillon réellement amorcé.
  return draft.draft.values ? children : null;
}

function renderScreen(seed?: Partial<ItemFormValues>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider fontsLoaded={false}>
        <ToastProvider>
          <AddItemDraftProvider>
            {seed ? (
              <SeededDraft seed={seed}>
                <AddItemFormScreen />
              </SeededDraft>
            ) : (
              <AddItemFormScreen />
            )}
          </AddItemDraftProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('AddItemFormScreen (create wrapper)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([CD_CATEGORY]);
    (mockApiClient.households.listMembers as jest.Mock).mockResolvedValue([MEMBER]);
  });

  it('resolves the category from categoryId and passes it through to the shared form', async () => {
    const view = await renderScreen();
    // Le titre dynamique prouve que la bonne Category (résolue depuis `categoryId`) a
    // bien été transmise à ItemFormScreen — n'attend pas le contexte catégorie de
    // l'étape 1 (bare "CD"), qui dépend en plus du chargement des membres.
    await waitFor(() => expect(view.getByText('Ajouter un CD')).toBeTruthy());
  });

  it('creates the item end-to-end through the wrapper', async () => {
    (mockApiClient.items.create as jest.Mock).mockResolvedValue({ id: 'item-1' });
    const view = await renderScreen();

    await waitFor(() => expect(view.getByLabelText('Titre')).toBeTruthy());
    await fireEvent.changeText(view.getByLabelText('Titre'), 'Discovery');
    await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
    await fireEvent.press(view.getByRole('button', { name: 'Suivant' }));
    await fireEvent.press(view.getByRole('button', { name: 'Alix' }));
    await fireEvent.press(view.getByRole('button', { name: 'Ajouter au nid' }));

    await waitFor(() =>
      expect(mockApiClient.items.create).toHaveBeenCalledWith(
        'household-1',
        expect.objectContaining({ categoryId: 'cat-cd', title: 'Discovery' }),
      ),
    );
  });

  it('offers a "Changer" link that requests the category-change confirmation', async () => {
    const view = await renderScreen();
    await waitFor(() => expect(view.getByLabelText('Changer de catégorie')).toBeTruthy());
    await fireEvent.press(view.getByLabelText('Changer de catégorie'));

    // Le brouillon est encore vide à ce stade (aucun champ rempli) : pas de confirmation.
    expect(mockRouterDismissTo).toHaveBeenCalledWith('/(app)/add-item/category');
    expect(view.queryByText('Changer de catégorie ?')).toBeNull();
  });

  it('asks with the exact message once data was entered — the whole draft is cleared, not only category fields', async () => {
    const view = await renderScreen();
    await waitFor(() => expect(view.getByLabelText('Titre')).toBeTruthy());
    await fireEvent.changeText(view.getByLabelText('Titre'), 'Discovery');
    await fireEvent.press(view.getByLabelText('Changer de catégorie'));

    await waitFor(() => expect(view.getByText('Changer de catégorie ?')).toBeTruthy());
    expect(view.getByText('Les informations déjà saisies seront perdues.')).toBeTruthy();
    expect(mockRouterDismissTo).not.toHaveBeenCalled();
  });

  it('prefills the Code-barres field from a barcode kept after a failed scan, leading zero intact', async () => {
    const view = await renderScreen({ barcode: '065935831686' });

    await waitFor(() => expect(view.getByLabelText('Code-barres')).toBeTruthy());
    expect(view.getByLabelText('Code-barres').props.value).toBe('065935831686');
    // Rien d'autre n'est inventé : le titre reste vide.
    expect(view.getByLabelText('Titre').props.value).toBe('');
  });
});
