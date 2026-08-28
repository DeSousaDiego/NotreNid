import type { UploadResult } from '@notre-nid/api-client';
import { useMutation } from '@tanstack/react-query';

import { useApiClient } from '../providers/AuthProvider';

export interface LocalImageFile {
  uri: string;
  name: string;
  type: string;
}

export function useUploadCover(householdId: string | null) {
  const apiClient = useApiClient();

  return useMutation<UploadResult, unknown, LocalImageFile>({
    mutationFn: (file) => {
      // Ne jamais poster vers /households/null/uploads : sans household résolu, on
      // échoue explicitement plutôt que de laisser un `as string` masquer le null.
      if (!householdId) {
        return Promise.reject(
          new Error('Aucun foyer sélectionné : impossible de téléverser une image.'),
        );
      }
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[useUploadCover] uploading', {
          uriScheme: file.uri.split(':')[0],
          hasName: Boolean(file.name),
          type: file.type,
          householdId,
        });
      }
      const formData = new FormData();
      // React Native's FormData accepts { uri, name, type } for files, but the
      // global type here resolves to the DOM FormData (lib "DOM"), which only
      // types `Blob` — the RN runtime supports both.
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as unknown as Blob);
      return apiClient.uploads.upload(householdId, formData);
    },
  });
}

export function useDeleteUpload(householdId: string | null) {
  const apiClient = useApiClient();

  return useMutation({
    mutationFn: (uploadId: string) => {
      if (!householdId) {
        return Promise.reject(
          new Error('Aucun foyer sélectionné : impossible de supprimer cette image.'),
        );
      }
      return apiClient.uploads.remove(householdId, uploadId);
    },
  });
}
