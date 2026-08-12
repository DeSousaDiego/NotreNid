import type {
  BookMetadata,
  CdMetadata,
  DvdMetadata,
  Item,
  ItemCondition,
  ItemsQueryParams,
  PaginatedResult,
} from '@notre-nid/shared';

import type { HttpClient } from '../http';

export type MetadataInput<T> = Partial<Omit<T, 'itemId'>>;

export interface ItemInput {
  categoryId: string;
  title: string;
  condition: ItemCondition;
  description?: string;
  notes?: string;
  coverImageUrl?: string;
  ownerIds: string[];
  book?: MetadataInput<BookMetadata>;
  cd?: MetadataInput<CdMetadata>;
  dvd?: MetadataInput<DvdMetadata>;
  customMetadata?: Record<string, unknown>;
}

export type CreateItemInput = ItemInput;
export type UpdateItemInput = Partial<ItemInput>;

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

    create: (householdId: string, input: CreateItemInput) =>
      http.request<Item>(`/households/${householdId}/items`, { method: 'POST', body: input }),

    update: (householdId: string, itemId: string, input: UpdateItemInput) =>
      http.request<Item>(`/households/${householdId}/items/${itemId}`, {
        method: 'PATCH',
        body: input,
      }),

    archive: (householdId: string, itemId: string) =>
      http.request<Item>(`/households/${householdId}/items/${itemId}`, { method: 'DELETE' }),

    restore: (householdId: string, itemId: string) =>
      http.request<Item>(`/households/${householdId}/items/${itemId}/restore`, {
        method: 'POST',
      }),
  };
}
