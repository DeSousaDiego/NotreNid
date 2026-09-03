import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createMockApiClient } from '../test-utils/mockApiClient';
import { createQueryWrapper } from '../test-utils/queryWrapper';

import { useCreateHousehold } from './useHouseholdMutations';

const mockApiClient = createMockApiClient();

jest.mock('../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

describe('useCreateHousehold', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards the household name and invalidates the households list', async () => {
    (mockApiClient.households.create as jest.Mock).mockResolvedValue({
      id: 'h1',
      name: 'Notre nid',
      role: 'OWNER',
    });
    const { queryClient, wrapper } = createQueryWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = await renderHook(() => useCreateHousehold(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('Notre nid');
    });

    expect(mockApiClient.households.create).toHaveBeenCalledWith('Notre nid');
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users', 'user-1', 'households'] }),
    );
  });
});
