import type { HouseholdWithRole } from '@notre-nid/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { queryKeys } from '../lib/queryKeys';
import { useApiClient, useAuth } from '../providers/AuthProvider';

export function useHouseholds(enabled: boolean) {
  const apiClient = useApiClient();
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.households(user?.id ?? '__none__'),
    queryFn: () => apiClient.households.list(),
    enabled: enabled && Boolean(user),
  });
}

/**
 * Recharge la liste des foyers dans le cache partagé (celui que lit `HouseholdProvider`)
 * et la retourne — rejette si le chargement échoue, contrairement à `invalidateQueries`
 * qui avale l'erreur. À utiliser quand la suite dépend réellement de la liste à jour
 * (ex. sélectionner un foyer qui vient d'être rejoint).
 */
export function useFetchHouseholds(): () => Promise<HouseholdWithRole[]> {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useCallback(
    () =>
      queryClient.fetchQuery({
        queryKey: queryKeys.households(user?.id ?? '__none__'),
        queryFn: () => apiClient.households.list(),
        staleTime: 0,
      }),
    [apiClient, queryClient, user?.id],
  );
}
