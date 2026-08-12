import type { Category, CategoryFieldSchema } from '@notre-nid/shared';

import type { HttpClient } from '../http';

export interface CreateCategoryInput {
  name: string;
  icon?: string;
  metadataSchema?: CategoryFieldSchema[];
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

export function createCategoriesEndpoints(http: HttpClient) {
  return {
    list: (householdId: string) =>
      http.request<Category[]>(`/households/${householdId}/categories`),

    create: (householdId: string, input: CreateCategoryInput) =>
      http.request<Category>(`/households/${householdId}/categories`, {
        method: 'POST',
        body: input,
      }),

    update: (householdId: string, categoryId: string, input: UpdateCategoryInput) =>
      http.request<Category>(`/households/${householdId}/categories/${categoryId}`, {
        method: 'PATCH',
        body: input,
      }),

    remove: (householdId: string, categoryId: string) =>
      http.request<void>(`/households/${householdId}/categories/${categoryId}`, {
        method: 'DELETE',
      }),
  };
}
