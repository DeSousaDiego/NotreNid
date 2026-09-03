import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import { useApiClient, useAuth } from '../providers/AuthProvider';

export function useInvitations(householdId: string | null) {
  const apiClient = useApiClient();
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.invitations(user?.id ?? '__none__', householdId ?? '__none__'),
    queryFn: () => apiClient.invitations.list(householdId as string),
    enabled: Boolean(householdId),
    staleTime: 30_000,
  });
}

/** `email` est facultatif (Bloc 2) : le code d'invitation suffit, sans SMTP. */
export function useCreateInvitation(householdId: string | null) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (email?: string) => apiClient.invitations.create(householdId as string, email),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.invitations(user?.id ?? '__none__', householdId as string),
      });
    },
  });
}

export function useRevokeInvitation(householdId: string | null) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (invitationId: string) => apiClient.invitations.revoke(invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.invitations(user?.id ?? '__none__', householdId as string),
      });
    },
  });
}

/**
 * Rejoindre un household via un code d'invitation (docs/NOTRE_NID_PRD.md, Bloc 2). Résout
 * avec `{ householdId, householdName, role }` : à l'appelant de sélectionner ce household
 * (`useHousehold().selectHousehold`) pour y faire entrer l'utilisateur sans redémarrage.
 */
export function useAcceptInvitation() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (code: string) => apiClient.invitations.accept(code),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.households(user?.id ?? '__none__'),
      });
    },
  });
}
