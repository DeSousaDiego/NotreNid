import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import { useApiClient } from '../providers/AuthProvider';

export function useHouseholds(enabled: boolean) {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: queryKeys.households,
    queryFn: () => apiClient.households.list(),
    enabled,
  });
}
