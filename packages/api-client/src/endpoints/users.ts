import type { PublicUser } from '@notre-nid/shared';

import type { HttpClient } from '../http';

export interface UpdateProfileInput {
  displayName: string;
}

export function createUsersEndpoints(http: HttpClient) {
  return {
    updateProfile: (input: UpdateProfileInput) =>
      http.request<PublicUser>('/users/me', { method: 'PATCH', body: input }),

    /**
     * `formData` doit contenir un champ `file` (construit côté application mobile —
     * ce package reste indépendant de React Native, voir `uploads.ts`/`http.ts`).
     */
    uploadAvatar: (formData: FormData) =>
      http.request<PublicUser>('/users/me/avatar', { method: 'POST', body: formData }),

    removeAvatar: () => http.request<PublicUser>('/users/me/avatar', { method: 'DELETE' }),
  };
}
