import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import {
  AddItemDraftProvider,
  useAddItemDraft,
} from '../../../screens/add-item/AddItemDraftContext';
import type { ItemFormValues } from '../../../screens/item-form/schema';
import { ThemeProvider } from '../../../theme';

import AddItemModeScreen from './mode';

jest.mock('expo-image', () => ({ Image: () => null }));

const mockRouterPush = jest.fn();
const mockRouterDismissTo = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
    dismissTo: (...args: unknown[]) => mockRouterDismissTo(...args),
  },
  useLocalSearchParams: () => ({ categoryId: 'cat-cd' }),
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

function Harness({ draftValues }: { draftValues?: Partial<ItemFormValues> }) {
  return (
    <AddItemDraftProvider>
      <DraftSeed draftValues={draftValues} />
    </AddItemDraftProvider>
  );
}

function DraftSeed({ draftValues }: { draftValues?: Partial<ItemFormValues> }) {
  const draft = useAddItemDraft();
  useEffect(() => {
    if (draftValues) draft.setValues(draftValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <AddItemModeScreen />;
}

function renderScreen(draftValues?: Partial<ItemFormValues>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider fontsLoaded={false}>
        <Harness draftValues={draftValues} />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('AddItemModeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockApiClient.categories.list as jest.Mock).mockResolvedValue([CD_CATEGORY]);
  });

  it('shows a dynamic title and a discreet recap of the chosen category', async () => {
    const view = await renderScreen();
    await waitFor(() => expect(view.getByText('Ajouter un CD')).toBeTruthy());
    expect(view.getAllByText('CD').length).toBeGreaterThan(0);
  });

  it('navigates to the scan placeholder when "Scanner un code-barres" is pressed', async () => {
    const view = await renderScreen();
    await waitFor(() => expect(view.getByText('Scanner un code-barres')).toBeTruthy());
    await fireEvent.press(view.getByText('Scanner un code-barres'));

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/(app)/add-item/scan',
      params: { categoryId: 'cat-cd' },
    });
  });

  it('navigates to the manual form when "Saisir manuellement" is pressed', async () => {
    const view = await renderScreen();
    await waitFor(() => expect(view.getByText('Saisir manuellement')).toBeTruthy());
    await fireEvent.press(view.getByText('Saisir manuellement'));

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/(app)/add-item/form',
      params: { categoryId: 'cat-cd' },
    });
  });

  it('changes category directly, without a confirmation, when no meaningful draft data exists', async () => {
    const view = await renderScreen();
    await waitFor(() => expect(view.getByLabelText('Changer de catégorie')).toBeTruthy());
    await fireEvent.press(view.getByLabelText('Changer de catégorie'));

    expect(mockRouterDismissTo).toHaveBeenCalledWith('/(app)/add-item/category');
    expect(view.queryByText('Changer de catégorie ?')).toBeNull();
  });

  it('asks for confirmation before changing category once meaningful draft data exists, and clears it on confirm', async () => {
    const view = await renderScreen({ title: 'Discovery' });
    await waitFor(() => expect(view.getByLabelText('Changer de catégorie')).toBeTruthy());
    await fireEvent.press(view.getByLabelText('Changer de catégorie'));

    await waitFor(() => expect(view.getByText('Changer de catégorie ?')).toBeTruthy());
    expect(mockRouterDismissTo).not.toHaveBeenCalled();

    await fireEvent.press(view.getByRole('button', { name: 'Changer' }));
    expect(mockRouterDismissTo).toHaveBeenCalledWith('/(app)/add-item/category');
  });
});
