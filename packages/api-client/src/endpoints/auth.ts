import type { AuthResult, PublicUser } from '@notre-nid/shared';

import type { HttpClient } from '../http';

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
  deviceName?: string;
}

export function createAuthEndpoints(http: HttpClient) {
  return {
    register: (input: RegisterInput) =>
      http.request<AuthResult>('/auth/register', { method: 'POST', body: input, auth: false }),

    login: (input: LoginInput) =>
      http.request<AuthResult>('/auth/login', { method: 'POST', body: input, auth: false }),

    refresh: (refreshToken: string) =>
      http.request<AuthResult>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
        auth: false,
      }),

    logout: (refreshToken: string) =>
      http.request<void>('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }),

    logoutAll: () => http.request<void>('/auth/logout-all', { method: 'POST' }),

    me: () => http.request<PublicUser>('/auth/me'),
  };
}
