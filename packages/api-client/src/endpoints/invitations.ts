import type { HouseholdInvitation, HouseholdInvitationWithCode } from '@notre-nid/shared';

import type { HttpClient } from '../http';

export interface AcceptInvitationResult {
  householdId: string;
  householdName: string;
  role: string;
}

export function createInvitationsEndpoints(http: HttpClient) {
  return {
    list: (householdId: string) =>
      http.request<HouseholdInvitation[]>(`/households/${householdId}/invitations`),

    /** `email` est facultatif depuis le Bloc 2 (invitation par code, sans SMTP requis). */
    create: (householdId: string, email?: string) =>
      http.request<HouseholdInvitationWithCode>(`/households/${householdId}/invitations`, {
        method: 'POST',
        body: { email },
      }),

    revoke: (invitationId: string) =>
      http.request<void>(`/invitations/${invitationId}/revoke`, { method: 'POST' }),

    accept: (code: string) =>
      http.request<AcceptInvitationResult>('/invitations/accept', {
        method: 'POST',
        body: { code },
      }),
  };
}
