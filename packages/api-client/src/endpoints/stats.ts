import type { HouseholdStats } from '@notre-nid/shared';

import type { HttpClient } from '../http';

export function createStatsEndpoints(http: HttpClient) {
  return {
    get: (householdId: string) => http.request<HouseholdStats>(`/households/${householdId}/stats`),
  };
}
