import type { ApiErrorBody, AuthResult } from '@notre-nid/shared';

import { ApiError, NetworkError } from './errors';
import { buildQueryString } from './query-string';
import type { ApiClientConfig, StoredTokens } from './types';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  /**
   * `FormData` (ex. upload de fichier) est envoyé tel quel, sans
   * `Content-Type: application/json` ni sérialisation — le runtime fixe
   * lui-même l'en-tête multipart avec la bonne frontière (`boundary`).
   */
  body?: unknown | FormData;
  query?: Record<string, string | number | boolean | undefined>;
  /**
   * `false` pour les routes publiques (register/login/refresh) : n'attache
   * aucun token et ne déclenche jamais le rafraîchissement automatique.
   * Par défaut : `true`.
   */
  auth?: boolean;
}

/**
 * Client HTTP bas niveau : attache le token d'accès, rafraîchit
 * automatiquement une seule fois sur 401 (single-flight, plusieurs requêtes
 * concurrentes partagent le même rafraîchissement), distingue les erreurs
 * applicatives (`ApiError`) des pannes réseau (`NetworkError`).
 */
export function createHttpClient(config: ApiClientConfig) {
  let refreshPromise: Promise<StoredTokens> | null = null;

  async function rawFetch(path: string, options: RequestOptions): Promise<Response> {
    const url = `${config.baseUrl}${path}${buildQueryString(options.query)}`;
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers: Record<string, string> = isFormData
      ? {}
      : { 'Content-Type': 'application/json' };

    if (options.auth !== false) {
      const tokens = await config.tokenStorage.getTokens();
      if (tokens?.accessToken) {
        headers.Authorization = `Bearer ${tokens.accessToken}`;
      }
    }

    try {
      return await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body: isFormData
          ? (options.body as FormData)
          : options.body !== undefined
            ? JSON.stringify(options.body)
            : undefined,
      });
    } catch {
      throw new NetworkError();
    }
  }

  async function parseErrorBody(response: Response): Promise<ApiErrorBody> {
    try {
      const body = (await response.json()) as Partial<ApiErrorBody>;
      return {
        statusCode: body.statusCode ?? response.status,
        code: body.code ?? 'ERROR',
        message: body.message ?? 'Une erreur est survenue.',
        details: body.details ?? [],
        requestId: body.requestId,
      };
    } catch {
      return {
        statusCode: response.status,
        code: 'ERROR',
        message: 'Une erreur est survenue.',
        details: [],
      };
    }
  }

  async function refreshTokens(): Promise<StoredTokens> {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const tokens = await config.tokenStorage.getTokens();
        if (!tokens?.refreshToken) {
          const body: ApiErrorBody = {
            statusCode: 401,
            code: 'NO_REFRESH_TOKEN',
            message: 'Session expirée.',
            details: [],
          };
          config.onSessionExpired?.();
          throw new ApiError(body);
        }

        const response = await rawFetch('/auth/refresh', {
          method: 'POST',
          body: { refreshToken: tokens.refreshToken },
          auth: false,
        });

        if (!response.ok) {
          await config.tokenStorage.clearTokens();
          config.onSessionExpired?.();
          throw new ApiError(await parseErrorBody(response));
        }

        const result = (await response.json()) as AuthResult;
        const newTokens: StoredTokens = {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        };
        await config.tokenStorage.setTokens(newTokens);
        return newTokens;
      })().finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  }

  async function requestRaw(path: string, options: RequestOptions = {}): Promise<Response> {
    let response = await rawFetch(path, options);

    if (response.status === 401 && options.auth !== false) {
      await refreshTokens();
      response = await rawFetch(path, options);
    }

    if (!response.ok) {
      throw new ApiError(await parseErrorBody(response));
    }

    return response;
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await requestRaw(path, options);
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  /** Réponses non-JSON (ex. export CSV, `Content-Type: text/csv`). */
  async function requestText(path: string, options: RequestOptions = {}): Promise<string> {
    const response = await requestRaw(path, options);
    return response.text();
  }

  return { request, requestText };
}

export type HttpClient = ReturnType<typeof createHttpClient>;
