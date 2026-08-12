import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createMockApiClient } from '../test-utils/mockApiClient';
import { createQueryWrapper } from '../test-utils/queryWrapper';

import { useLeaveHousehold, useRemoveMember, useUpdateMemberRole } from './useMemberMutations';

const mockApiClient = createMockApiClient();

jest.mock('../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
}));

const HOUSEHOLD_ID = 'h1';

describe('useMemberMutations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('useUpdateMemberRole forwards householdId/userId/role and invalidates members', async () => {
    (mockApiClient.households.updateMemberRole as jest.Mock).mockResolvedValue({});
    const { queryClient, wrapper } = createQueryWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = await renderHook(() => useUpdateMemberRole(HOUSEHOLD_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ userId: 'u2', role: 'ADMIN' });
    });

    expect(mockApiClient.households.updateMemberRole).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      'u2',
      'ADMIN',
    );
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['households', HOUSEHOLD_ID, 'members'],
      }),
    );
  });

  it('useRemoveMember forwards the target user id', async () => {
    (mockApiClient.households.removeMember as jest.Mock).mockResolvedValue(undefined);
    const { wrapper } = createQueryWrapper();

    const { result } = await renderHook(() => useRemoveMember(HOUSEHOLD_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('u2');
    });

    expect(mockApiClient.households.removeMember).toHaveBeenCalledWith(HOUSEHOLD_ID, 'u2');
  });

  it('useLeaveHousehold calls leave() and invalidates the households list', async () => {
    (mockApiClient.households.leave as jest.Mock).mockResolvedValue(undefined);
    const { queryClient, wrapper } = createQueryWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = await renderHook(() => useLeaveHousehold(HOUSEHOLD_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockApiClient.households.leave).toHaveBeenCalledWith(HOUSEHOLD_ID);
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['households'] }));
  });

  it('surfaces LAST_OWNER_CANNOT_LEAVE errors from the API without swallowing them', async () => {
    const apiError = Object.assign(new Error('dernier propriétaire'), {
      code: 'LAST_OWNER_CANNOT_LEAVE',
    });
    (mockApiClient.households.leave as jest.Mock).mockRejectedValue(apiError);
    const { wrapper } = createQueryWrapper();

    const { result } = await renderHook(() => useLeaveHousehold(HOUSEHOLD_ID), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toMatchObject({
        code: 'LAST_OWNER_CANNOT_LEAVE',
      });
    });
  });
});
