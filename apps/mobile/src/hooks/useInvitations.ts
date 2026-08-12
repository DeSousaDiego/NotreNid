import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import { useApiClient } from '../providers/AuthProvider';

export function useInvitations(householdId: string | null) {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: queryKeys.invitations(householdId ?? '__none__'),
    queryFn: () => apiClient.invitations.list(householdId as string),
    enabled: Boolean(householdId),
    staleTime: 30_000,
  });
}

export function useCreateInvitation(householdId: string | null) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (email: string) => apiClient.invitations.create(householdId as string, email),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.invitations(householdId as string),
      });
    },
  });
}

export function useRevokeInvitation(householdId: string | null) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => apiClient.invitations.revoke(invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.invitations(householdId as string),
      });
    },
  });
}

/** Rejoindre un household via un jeton d'invitation (docs/NOTRE_NID_PRD.md section 2, point 6). */
export function useAcceptInvitation() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => apiClient.invitations.accept(token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.households });
    },
  });
}
