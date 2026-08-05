import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import { useApiClient } from '../providers/AuthProvider';

export function useStats(householdId: string | null) {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: queryKeys.stats(householdId ?? '__none__'),
    queryFn: () => apiClient.stats.get(householdId as string),
    enabled: Boolean(householdId),
  });
}
