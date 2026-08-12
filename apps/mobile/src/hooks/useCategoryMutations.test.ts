import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createMockApiClient } from '../test-utils/mockApiClient';
import { createQueryWrapper } from '../test-utils/queryWrapper';

import { useCreateCategory, useDeleteCategory, useUpdateCategory } from './useCategoryMutations';

const mockApiClient = createMockApiClient();

jest.mock('../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
}));

const HOUSEHOLD_ID = 'h1';

describe('useCategoryMutations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('useCreateCategory calls create() and invalidates the categories list', async () => {
    (mockApiClient.categories.create as jest.Mock).mockResolvedValue({ id: 'cat-1' });
    const { queryClient, wrapper } = createQueryWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = await renderHook(() => useCreateCategory(HOUSEHOLD_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: 'Vinyles' });
    });

    expect(mockApiClient.categories.create).toHaveBeenCalledWith(HOUSEHOLD_ID, {
      name: 'Vinyles',
    });
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['households', HOUSEHOLD_ID, 'categories'],
      }),
    );
  });

  it('useUpdateCategory invalidates both categories and items lists', async () => {
    (mockApiClient.categories.update as jest.Mock).mockResolvedValue({ id: 'cat-1' });
    const { queryClient, wrapper } = createQueryWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = await renderHook(() => useUpdateCategory(HOUSEHOLD_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ categoryId: 'cat-1', input: { name: 'Vinyles 33t' } });
    });

    expect(mockApiClient.categories.update).toHaveBeenCalledWith(HOUSEHOLD_ID, 'cat-1', {
      name: 'Vinyles 33t',
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['households', HOUSEHOLD_ID, 'categories'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['households', HOUSEHOLD_ID, 'items'],
      });
    });
  });

  it('useDeleteCategory calls remove() with the category id', async () => {
    (mockApiClient.categories.remove as jest.Mock).mockResolvedValue(undefined);
    const { wrapper } = createQueryWrapper();

    const { result } = await renderHook(() => useDeleteCategory(HOUSEHOLD_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('cat-1');
    });

    expect(mockApiClient.categories.remove).toHaveBeenCalledWith(HOUSEHOLD_ID, 'cat-1');
  });
});
