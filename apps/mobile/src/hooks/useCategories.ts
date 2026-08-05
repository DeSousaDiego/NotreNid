import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import { useApiClient } from '../providers/AuthProvider';

export function useCategories(householdId: string | null) {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: queryKeys.categories(householdId ?? '__none__'),
    queryFn: () => apiClient.categories.list(householdId as string),
    enabled: Boolean(householdId),
    staleTime: 5 * 60_000,
  });
}
