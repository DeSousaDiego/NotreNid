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
      const formData = new FormData();
      // React Native's FormData accepts { uri, name, type } for files, but the
      // global type here resolves to the DOM FormData (lib "DOM"), which only
      // types `Blob` — the RN runtime supports both.
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as unknown as Blob);
      return apiClient.uploads.upload(householdId as string, formData);
    },
  });
}

export function useDeleteUpload(householdId: string | null) {
  const apiClient = useApiClient();

  return useMutation({
    mutationFn: (uploadId: string) => apiClient.uploads.remove(householdId as string, uploadId),
  });
}
