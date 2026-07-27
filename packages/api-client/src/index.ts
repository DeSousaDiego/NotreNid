import { APP_NAME } from '@notre-nid/shared';

/**
 * Client API typé pour l'application mobile.
 *
 * Phase 1 (Fondation) : squelette du package uniquement. La configuration
 * réseau, l'authentification, le rafraîchissement des tokens et les
 * méthodes générées depuis le contrat OpenAPI seront ajoutés à partir de
 * la Phase 2, une fois les premières routes de l'API disponibles.
 */

export interface ApiClientConfig {
  baseUrl: string;
}

export function describeApiClient(config: ApiClientConfig): string {
  return `${APP_NAME} api-client configured for ${config.baseUrl}`;
}
