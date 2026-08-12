import type { HouseholdExportItem } from '@notre-nid/shared';

import type { HttpClient } from '../http';

export function createExportsEndpoints(http: HttpClient) {
  return {
    json: (householdId: string) =>
      http.request<HouseholdExportItem[]>(`/households/${householdId}/exports/json`),

    csv: (householdId: string) => http.requestText(`/households/${householdId}/exports/csv`),
  };
}
