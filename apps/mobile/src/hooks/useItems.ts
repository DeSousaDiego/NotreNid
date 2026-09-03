import type { ItemsQueryParams } from '@notre-nid/shared';
import { useInfiniteQuery } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import { useApiClient, useAuth } from '../providers/AuthProvider';

const DEFAULT_PAGE_SIZE = 20;

export function useItems(householdId: string | null, filters: ItemsQueryParams) {
  const apiClient = useApiClient();
  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: queryKeys.items(user?.id ?? '__none__', householdId ?? '__none__', filters),
    queryFn: ({ pageParam }) =>
      apiClient.items.list(householdId as string, {
        ...filters,
        page: pageParam,
        pageSize: filters.pageSize ?? DEFAULT_PAGE_SIZE,
      }),
    enabled: Boolean(householdId),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined,
  });
}
