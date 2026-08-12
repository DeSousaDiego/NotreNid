import type {
  Household,
  HouseholdMember,
  HouseholdRole,
  HouseholdWithRole,
} from '@notre-nid/shared';

import type { HttpClient } from '../http';

export function createHouseholdsEndpoints(http: HttpClient) {
  return {
    list: () => http.request<HouseholdWithRole[]>('/households'),

    get: (householdId: string) => http.request<Household>(`/households/${householdId}`),

    create: (name: string) =>
      http.request<HouseholdWithRole>('/households', { method: 'POST', body: { name } }),

    rename: (householdId: string, name: string) =>
      http.request<Household>(`/households/${householdId}`, { method: 'PATCH', body: { name } }),

    listMembers: (householdId: string) =>
      http.request<HouseholdMember[]>(`/households/${householdId}/members`),

    updateMemberRole: (householdId: string, userId: string, role: HouseholdRole) =>
      http.request<unknown>(`/households/${householdId}/members/${userId}`, {
        method: 'PATCH',
        body: { role },
      }),

    removeMember: (householdId: string, userId: string) =>
      http.request<void>(`/households/${householdId}/members/${userId}`, { method: 'DELETE' }),

    leave: (householdId: string) =>
      http.request<void>(`/households/${householdId}/leave`, { method: 'POST' }),
  };
}
