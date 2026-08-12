import type { HouseholdInvitation, HouseholdInvitationWithToken } from '@notre-nid/shared';

import type { HttpClient } from '../http';

export function createInvitationsEndpoints(http: HttpClient) {
  return {
    list: (householdId: string) =>
      http.request<HouseholdInvitation[]>(`/households/${householdId}/invitations`),

    create: (householdId: string, email: string) =>
      http.request<HouseholdInvitationWithToken>(`/households/${householdId}/invitations`, {
        method: 'POST',
        body: { email },
      }),

    revoke: (invitationId: string) =>
      http.request<void>(`/invitations/${invitationId}/revoke`, { method: 'POST' }),

    accept: (token: string) =>
      http.request<unknown>(`/invitations/${token}/accept`, { method: 'POST' }),
  };
}
