import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import { useApiClient } from '../providers/AuthProvider';

export function useMembers(householdId: string | null) {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: queryKeys.members(householdId ?? '__none__'),
    queryFn: () => apiClient.households.listMembers(householdId as string),
    enabled: Boolean(householdId),
    staleTime: 60_000,
  });
}
