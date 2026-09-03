import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import { useApiClient, useAuth } from '../providers/AuthProvider';

export function useCategories(householdId: string | null) {
  const apiClient = useApiClient();
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.categories(user?.id ?? '__none__', householdId ?? '__none__'),
    queryFn: () => apiClient.categories.list(householdId as string),
    enabled: Boolean(householdId),
    staleTime: 5 * 60_000,
  });
}
