import type { HouseholdRole } from '@notre-nid/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import { useApiClient } from '../providers/AuthProvider';

export function useUpdateMemberRole(householdId: string | null) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: HouseholdRole }) =>
      apiClient.households.updateMemberRole(householdId as string, userId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members(householdId as string) });
    },
  });
}

export function useRemoveMember(householdId: string | null) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      apiClient.households.removeMember(householdId as string, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members(householdId as string) });
    },
  });
}

export function useLeaveHousehold(householdId: string | null) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.households.leave(householdId as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.households });
    },
  });
}
