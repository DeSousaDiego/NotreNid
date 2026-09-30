import { notifyManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createMockApiClient } from '../test-utils/mockApiClient';
import { createQueryWrapper } from '../test-utils/queryWrapper';

import { useHouseholds } from './useHouseholds';
import { useLeaveHousehold, useRemoveMember, useUpdateMemberRole } from './useMemberMutations';

const mockApiClient = createMockApiClient();

jest.mock('../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
  useAuth: () => ({ user: { id: 'user-1' } }),
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
        queryKey: ['users', 'user-1', 'households', HOUSEHOLD_ID, 'members'],
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

  describe('useLeaveHousehold', () => {
    const H1 = { id: HOUSEHOLD_ID, name: 'Le Nid', role: 'MEMBER' };
    const H2 = { id: 'h2', name: 'Le Chalet', role: 'OWNER' };
    const householdsKey = ['users', 'user-1', 'households'];

    // TanStack Query diffuse ses mises à jour de cache via `setTimeout(0)` : une mutation
    // laissée volontairement en attente entre deux `act()` notifierait alors ses observateurs
    // hors `act`. Diffusion synchrone ici, pour que chaque mise à jour reste dans son `act`.
    beforeAll(() => notifyManager.setScheduler((callback) => callback()));
    afterAll(() => notifyManager.setScheduler((callback) => setTimeout(callback, 0)));

    /** Liste des foyers observée comme dans l'app (`HouseholdProvider`), données du foyer en cache. */
    async function renderLeaveWithObservedHouseholds() {
      (mockApiClient.households.list as jest.Mock).mockResolvedValueOnce([H1, H2]);
      const { queryClient, wrapper } = createQueryWrapper();
      const { result } = await renderHook(
        () => ({ leave: useLeaveHousehold(HOUSEHOLD_ID), households: useHouseholds(true) }),
        { wrapper },
      );
      await waitFor(() => expect(result.current.households.data).toEqual([H1, H2]));
      for (const scope of ['members', 'items', 'stats', 'invitations', 'categories']) {
        queryClient.setQueryData(['users', 'user-1', 'households', HOUSEHOLD_ID, scope], []);
        queryClient.setQueryData(['users', 'user-1', 'households', 'h2', scope], []);
      }
      return { result, queryClient };
    }

    it('resolves only after the households list was refetched, never listing the left household', async () => {
      (mockApiClient.households.leave as jest.Mock).mockResolvedValue(undefined);
      const { result, queryClient } = await renderLeaveWithObservedHouseholds();

      let resolveRefetch: (households: unknown[]) => void = () => undefined;
      const refetchStarted = new Promise<void>((started) => {
        (mockApiClient.households.list as jest.Mock).mockImplementationOnce(() => {
          started();
          return new Promise((resolve) => {
            resolveRefetch = resolve;
          });
        });
      });

      let settled = false;
      let leavePromise: Promise<void> = Promise.resolve();
      await act(async () => {
        leavePromise = result.current.leave.mutateAsync().then(() => {
          settled = true;
        });
        await refetchStarted;
      });

      expect(mockApiClient.households.list).toHaveBeenCalledTimes(2);
      expect(mockApiClient.households.leave).toHaveBeenCalledWith(HOUSEHOLD_ID);
      // Retiré de la liste dès la confirmation de l'API, avant même la fin du rechargement.
      expect(queryClient.getQueryData(householdsKey)).toEqual([H2]);
      expect(settled).toBe(false);

      await act(async () => {
        resolveRefetch([H2]);
        await leavePromise;
      });

      expect(settled).toBe(true);
      expect(queryClient.getQueryData(householdsKey)).toEqual([H2]);
    });

    it('purges every cached query of the left household, and only of that one', async () => {
      (mockApiClient.households.leave as jest.Mock).mockResolvedValue(undefined);
      const { result, queryClient } = await renderLeaveWithObservedHouseholds();
      (mockApiClient.households.list as jest.Mock).mockResolvedValueOnce([H2]);

      await act(async () => {
        await result.current.leave.mutateAsync();
      });

      for (const scope of ['members', 'items', 'stats', 'invitations', 'categories']) {
        expect(
          queryClient.getQueryState(['users', 'user-1', 'households', HOUSEHOLD_ID, scope]),
        ).toBeUndefined();
        expect(queryClient.getQueryData(['users', 'user-1', 'households', 'h2', scope])).toEqual(
          [],
        );
      }
    });

    it('keeps the left household out of the list even if the refetch fails', async () => {
      (mockApiClient.households.leave as jest.Mock).mockResolvedValue(undefined);
      const { result, queryClient } = await renderLeaveWithObservedHouseholds();
      (mockApiClient.households.list as jest.Mock).mockRejectedValueOnce(new Error('offline'));

      await act(async () => {
        await result.current.leave.mutateAsync();
      });

      expect(mockApiClient.households.list).toHaveBeenCalledTimes(2);
      expect(queryClient.getQueryData(householdsKey)).toEqual([H2]);
    });
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
