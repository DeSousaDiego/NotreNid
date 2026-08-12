import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createMockApiClient } from '../test-utils/mockApiClient';
import { createQueryWrapper } from '../test-utils/queryWrapper';

import { useArchiveItem, useCreateItem, useRestoreItem, useUpdateItem } from './useItemMutations';

const mockApiClient = createMockApiClient();

jest.mock('../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
}));

const HOUSEHOLD_ID = 'h1';

const mockItem = {
  id: 'item-1',
  householdId: HOUSEHOLD_ID,
  title: 'Dune',
} as unknown as Awaited<ReturnType<typeof mockApiClient.items.create>>;

describe('useItemMutations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('useCreateItem invalidates the items list and stats on success', async () => {
    (mockApiClient.items.create as jest.Mock).mockResolvedValue(mockItem);
    const { queryClient, wrapper } = createQueryWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = await renderHook(() => useCreateItem(HOUSEHOLD_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        categoryId: 'cat-1',
        title: 'Dune',
        condition: 'NEW',
        ownerIds: ['u1'],
      });
    });

    expect(mockApiClient.items.create).toHaveBeenCalledWith(HOUSEHOLD_ID, {
      categoryId: 'cat-1',
      title: 'Dune',
      condition: 'NEW',
      ownerIds: ['u1'],
    });
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['households', HOUSEHOLD_ID, 'items'],
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['households', HOUSEHOLD_ID, 'stats'],
    });
  });

  it('useUpdateItem writes the updated item into the cache and invalidates lists', async () => {
    (mockApiClient.items.update as jest.Mock).mockResolvedValue(mockItem);
    const { queryClient, wrapper } = createQueryWrapper();
    const setSpy = jest.spyOn(queryClient, 'setQueryData');

    const { result } = await renderHook(() => useUpdateItem(HOUSEHOLD_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ itemId: 'item-1', input: { title: 'Dune (2ᵉ éd.)' } });
    });

    expect(mockApiClient.items.update).toHaveBeenCalledWith(HOUSEHOLD_ID, 'item-1', {
      title: 'Dune (2ᵉ éd.)',
    });
    expect(setSpy).toHaveBeenCalledWith(['households', HOUSEHOLD_ID, 'items', 'item-1'], mockItem);
  });

  it('useArchiveItem calls the archive endpoint with the item id', async () => {
    (mockApiClient.items.archive as jest.Mock).mockResolvedValue(mockItem);
    const { wrapper } = createQueryWrapper();

    const { result } = await renderHook(() => useArchiveItem(HOUSEHOLD_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('item-1');
    });

    expect(mockApiClient.items.archive).toHaveBeenCalledWith(HOUSEHOLD_ID, 'item-1');
  });

  it('useRestoreItem calls the restore endpoint with the item id', async () => {
    (mockApiClient.items.restore as jest.Mock).mockResolvedValue(mockItem);
    const { wrapper } = createQueryWrapper();

    const { result } = await renderHook(() => useRestoreItem(HOUSEHOLD_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('item-1');
    });

    expect(mockApiClient.items.restore).toHaveBeenCalledWith(HOUSEHOLD_ID, 'item-1');
  });
});
