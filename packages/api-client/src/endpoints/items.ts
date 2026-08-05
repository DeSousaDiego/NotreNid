import type { Item, ItemsQueryParams, PaginatedResult } from '@notre-nid/shared';

import type { HttpClient } from '../http';

export function createItemsEndpoints(http: HttpClient) {
  return {
    list: (householdId: string, query: ItemsQueryParams = {}) =>
      http.request<PaginatedResult<Item>>(`/households/${householdId}/items`, {
        query: {
          search: query.search,
          categoryId: query.categoryId,
          ownerId: query.ownerId,
          condition: query.condition,
          archived: query.archived,
          createdById: query.createdById,
          sort: query.sort,
          order: query.order,
          page: query.page,
          pageSize: query.pageSize,
        },
      }),

    get: (householdId: string, itemId: string) =>
      http.request<Item>(`/households/${householdId}/items/${itemId}`),
  };
}
