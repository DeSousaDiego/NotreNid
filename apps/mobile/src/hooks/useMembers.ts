import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import { useApiClient, useAuth } from '../providers/AuthProvider';

export function useMembers(householdId: string | null) {
  const apiClient = useApiClient();
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.members(user?.id ?? '__none__', householdId ?? '__none__'),
    queryFn: () => apiClient.households.listMembers(householdId as string),
    enabled: Boolean(householdId),
    staleTime: 60_000,
  });
}
