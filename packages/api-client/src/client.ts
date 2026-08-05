import { createAuthEndpoints } from './endpoints/auth';
import { createCategoriesEndpoints } from './endpoints/categories';
import { createHouseholdsEndpoints } from './endpoints/households';
import { createItemsEndpoints } from './endpoints/items';
import { createStatsEndpoints } from './endpoints/stats';
import { createHttpClient } from './http';
import type { ApiClientConfig } from './types';

export function createApiClient(config: ApiClientConfig) {
  const http = createHttpClient(config);

  return {
    auth: createAuthEndpoints(http),
    households: createHouseholdsEndpoints(http),
    categories: createCategoriesEndpoints(http),
    items: createItemsEndpoints(http),
    stats: createStatsEndpoints(http),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
