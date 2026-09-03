import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import { useApiClient, useAuth } from '../providers/AuthProvider';

export function useItem(householdId: string | null, itemId: string) {
  const apiClient = useApiClient();
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.item(user?.id ?? '__none__', householdId ?? '__none__', itemId),
    queryFn: () => apiClient.items.get(householdId as string, itemId),
    enabled: Boolean(householdId),
  });
}
