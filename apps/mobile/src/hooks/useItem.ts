import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import { useApiClient } from '../providers/AuthProvider';

export function useItem(householdId: string | null, itemId: string) {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: queryKeys.item(householdId ?? '__none__', itemId),
    queryFn: () => apiClient.items.get(householdId as string, itemId),
    enabled: Boolean(householdId),
  });
}
