import type { Household, HouseholdMember, HouseholdWithRole } from '@notre-nid/shared';

import type { HttpClient } from '../http';

export function createHouseholdsEndpoints(http: HttpClient) {
  return {
    list: () => http.request<HouseholdWithRole[]>('/households'),

    get: (householdId: string) => http.request<Household>(`/households/${householdId}`),

    listMembers: (householdId: string) =>
      http.request<HouseholdMember[]>(`/households/${householdId}/members`),
  };
}
