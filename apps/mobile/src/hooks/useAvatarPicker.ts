import { useState } from 'react';

import { useRemoveAvatar, useUploadAvatar } from './useProfileMutations';
import { getErrorMessage } from '../lib/errorMessage';
import { pickImageFromCamera, pickImageFromLibrary } from '../lib/imagePicker';

/**
 * Sélection et remplacement/retrait de la photo de profil — même logique de picker que
 * `useCoverPicker` (partagée via `lib/imagePicker.ts`), mais téléversée sur l'endpoint
 * utilisateur (`/users/me/avatar`) plutôt que sur celui, scopé household, des couvertures
 * d'item (Bloc 4, docs/PHASE_STATUS.md).
 */
export function useAvatarPicker() {
  const uploadMutation = useUploadAvatar();
  const removeMutation = useRemoveAvatar();
  const [error, setError] = useState<string | null>(null);

  const upload = async (uri: string) => {
    try {
      await uploadMutation.mutateAsync({ uri });
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
    }
  };

  const pickFromLibrary = async () => {
    setError(null);
    const result = await pickImageFromLibrary();
    if (result.status === 'denied' || result.status === 'failed') {
      setError(result.message);
      return;
    }
    if (result.status === 'cancelled') return;
    await upload(result.asset.uri);
  };

  const pickFromCamera = async () => {
    setError(null);
    const result = await pickImageFromCamera();
    if (result.status === 'denied' || result.status === 'failed') {
      setError(result.message);
      return;
    }
    if (result.status === 'cancelled') return;
    await upload(result.asset.uri);
  };

  const removePhoto = async () => {
    setError(null);
    try {
      await removeMutation.mutateAsync();
    } catch (removeError) {
      setError(getErrorMessage(removeError));
    }
  };

  return {
    isUploading: uploadMutation.isPending,
    isRemoving: removeMutation.isPending,
    error,
    pickFromLibrary,
    pickFromCamera,
    removePhoto,
  };
}
