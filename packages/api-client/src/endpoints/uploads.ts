import type { HttpClient } from '../http';

export interface UploadResult {
  id: string;
  url: string;
}

export function createUploadsEndpoints(http: HttpClient) {
  return {
    /**
     * `formData` doit contenir un champ `file` (construit côté application
     * mobile — ce package reste indépendant de React Native, voir `http.ts`).
     */
    upload: (householdId: string, formData: FormData) =>
      http.request<UploadResult>(`/households/${householdId}/uploads`, {
        method: 'POST',
        body: formData,
      }),

    remove: (householdId: string, uploadId: string) =>
      http.request<void>(`/households/${householdId}/uploads/${uploadId}`, { method: 'DELETE' }),
  };
}
