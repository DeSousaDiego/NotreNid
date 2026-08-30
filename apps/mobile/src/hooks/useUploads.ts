import type { UploadResult } from '@notre-nid/api-client';
import { useMutation } from '@tanstack/react-query';
import { File } from 'expo-file-system';

import { useApiClient } from '../providers/AuthProvider';

export interface LocalImageFile {
  uri: string;
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
          householdId,
        });
      }
      const formData = new FormData();
      // Le fetch global installé par Expo (voir docs/DECISIONS.md) ne sait plus
      // sérialiser la pseudo-partie React Native historique `{ uri, name, type }` —
      // il lève "Unsupported FormDataPart implementation" (confirmé en lisant
      // expo/src/winter/fetch/convertFormData.ts : seuls string, Blob et tout objet
      // exposant .bytes() sont reconnus). Un vrai `File` expose `.bytes()`, et dérive
      // nom/type MIME directement de l'URI — donc correct même si le picker ne
      // fournit ni fileName ni mimeType.
      formData.append('file', new File(file.uri));
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
