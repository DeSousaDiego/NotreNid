import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import { useApiClient, useAuth } from '../providers/AuthProvider';

export function useStats(householdId: string | null) {
  const apiClient = useApiClient();
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.stats(user?.id ?? '__none__', householdId ?? '__none__'),
    queryFn: () => apiClient.stats.get(householdId as string),
    enabled: Boolean(householdId),
  });
}
