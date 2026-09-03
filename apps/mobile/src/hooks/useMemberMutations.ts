import type { HouseholdRole } from '@notre-nid/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import { useApiClient, useAuth } from '../providers/AuthProvider';

export function useUpdateMemberRole(householdId: string | null) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? '__none__';

  return useMutation({
    mutationFn: ({ userId: targetUserId, role }: { userId: string; role: HouseholdRole }) =>
      apiClient.households.updateMemberRole(householdId as string, targetUserId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.members(userId, householdId as string),
      });
    },
  });
}

export function useRemoveMember(householdId: string | null) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? '__none__';

  return useMutation({
    mutationFn: (targetUserId: string) =>
      apiClient.households.removeMember(householdId as string, targetUserId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.members(userId, householdId as string),
      });
    },
  });
}

export function useLeaveHousehold(householdId: string | null) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: () => apiClient.households.leave(householdId as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.households(user?.id ?? '__none__'),
      });
    },
  });
}
