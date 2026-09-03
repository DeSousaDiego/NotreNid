import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createMockApiClient } from '../test-utils/mockApiClient';
import { createQueryWrapper } from '../test-utils/queryWrapper';

import {
  useAcceptInvitation,
  useCreateInvitation,
  useInvitations,
  useRevokeInvitation,
} from './useInvitations';

const mockApiClient = createMockApiClient();

jest.mock('../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

const HOUSEHOLD_ID = 'h1';

describe('useInvitations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists invitations for the given household', async () => {
    (mockApiClient.invitations.list as jest.Mock).mockResolvedValue([{ id: 'inv-1' }]);
    const { wrapper } = createQueryWrapper();

    const { result } = await renderHook(() => useInvitations(HOUSEHOLD_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'inv-1' }]);
    expect(mockApiClient.invitations.list).toHaveBeenCalledWith(HOUSEHOLD_ID);
  });

  it('is disabled without a household id', async () => {
    const { wrapper } = createQueryWrapper();
    await renderHook(() => useInvitations(null), { wrapper });
    expect(mockApiClient.invitations.list).not.toHaveBeenCalled();
  });

  it('useCreateInvitation forwards the email and invalidates the invitations list', async () => {
    (mockApiClient.invitations.create as jest.Mock).mockResolvedValue({
      id: 'inv-1',
      code: '7K4P2Q9D',
    });
    const { queryClient, wrapper } = createQueryWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = await renderHook(() => useCreateInvitation(HOUSEHOLD_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('sam@example.com');
    });

    expect(mockApiClient.invitations.create).toHaveBeenCalledWith(HOUSEHOLD_ID, 'sam@example.com');
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['users', 'user-1', 'households', HOUSEHOLD_ID, 'invitations'],
      }),
    );
  });

  it('useRevokeInvitation forwards the invitation id', async () => {
    (mockApiClient.invitations.revoke as jest.Mock).mockResolvedValue(undefined);
    const { wrapper } = createQueryWrapper();

    const { result } = await renderHook(() => useRevokeInvitation(HOUSEHOLD_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('inv-1');
    });

    expect(mockApiClient.invitations.revoke).toHaveBeenCalledWith('inv-1');
  });

  it('useAcceptInvitation forwards the raw code and invalidates the households list', async () => {
    (mockApiClient.invitations.accept as jest.Mock).mockResolvedValue({
      householdId: 'h1',
      householdName: 'Le Nid',
      role: 'MEMBER',
    });
    const { queryClient, wrapper } = createQueryWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = await renderHook(() => useAcceptInvitation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('7K4P2Q9D');
    });

    expect(mockApiClient.invitations.accept).toHaveBeenCalledWith('7K4P2Q9D');
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users', 'user-1', 'households'] }),
    );
  });
});
