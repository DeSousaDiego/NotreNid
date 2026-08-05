import type { Category } from '@notre-nid/shared';

import type { HttpClient } from '../http';

export function createCategoriesEndpoints(http: HttpClient) {
  return {
    list: (householdId: string) =>
      http.request<Category[]>(`/households/${householdId}/categories`),
  };
}
