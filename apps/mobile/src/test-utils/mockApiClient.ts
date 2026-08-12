import type { ApiClient } from '@notre-nid/api-client';

/** Fabrique un `ApiClient` entièrement mocké (jest.fn() par endpoint) pour les tests de hooks. */
export function createMockApiClient(): ApiClient {
  return {
    auth: {
      me: jest.fn(),
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      logoutAll: jest.fn(),
      refresh: jest.fn(),
    },
    households: {
      list: jest.fn(),
      get: jest.fn(),
      create: jest.fn(),
      rename: jest.fn(),
      listMembers: jest.fn(),
      updateMemberRole: jest.fn(),
      removeMember: jest.fn(),
      leave: jest.fn(),
    },
    categories: {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    },
    items: {
      list: jest.fn(),
      get: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      restore: jest.fn(),
    },
    stats: {
      get: jest.fn(),
    },
    invitations: {
      list: jest.fn(),
      create: jest.fn(),
      revoke: jest.fn(),
      accept: jest.fn(),
    },
    uploads: {
      upload: jest.fn(),
      remove: jest.fn(),
    },
    exports: {
      json: jest.fn(),
      csv: jest.fn(),
    },
  } as unknown as ApiClient;
}
