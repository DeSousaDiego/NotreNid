import type { HouseholdRole, HouseholdWithRole } from '@notre-nid/shared';
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

/**
 * Quitter le foyer courant. `mutateAsync` ne résout qu'une fois le cache cohérent :
 *
 * 1. le foyer quitté est retiré immédiatement de la liste en cache — l'API vient de
 *    confirmer le départ, donc aucun écran (sélection de foyer, sélection automatique
 *    de `HouseholdProvider`) ne peut plus le proposer, même si le rechargement échoue ;
 * 2. la liste est rechargée (attendu, erreur tolérée : l'étape 1 suffit à la cohérence) ;
 * 3. les données propres au foyer quitté (membres, items, stats, invitations, catégories)
 *    sont supprimées du cache — après le rechargement, une fois que plus aucun écran ne
 *    les observe, pour ne pas provoquer de requête vers un foyer désormais interdit.
 *
 * La sélection et la navigation restent à la charge de l'écran appelant.
 */
export function useLeaveHousehold(householdId: string | null) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? '__none__';

  return useMutation({
    mutationFn: () => apiClient.households.leave(householdId as string),
    onSuccess: async () => {
      const householdsKey = queryKeys.households(userId);
      queryClient.setQueryData<HouseholdWithRole[]>(householdsKey, (households) =>
        households?.filter((h) => h.id !== householdId),
      );
      await queryClient.invalidateQueries({ queryKey: householdsKey });
      queryClient.removeQueries({
        queryKey: queryKeys.householdScope(userId, householdId as string),
      });
    },
  });
}
