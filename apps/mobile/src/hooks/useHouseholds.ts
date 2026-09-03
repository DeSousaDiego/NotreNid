import { useQuery } from '@tanstack/react-query';

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
