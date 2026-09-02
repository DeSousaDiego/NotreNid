import type * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

import { pickImageFromCamera, pickImageFromLibrary } from '../../lib/imagePicker';
import { useDeleteUpload, useUploadCover } from '../../hooks/useUploads';
import { getErrorMessage } from '../../lib/errorMessage';

export interface UseCoverPickerOptions {
  householdId: string | null;
  /** URL de couverture actuelle (mode édition) ou déjà téléversée durant cette session. */
  value: string;
  onChange: (url: string) => void;
}

/**
 * Sélection, aperçu, remplacement et suppression d'une image de couverture
 * (docs/NOTRE_NID_PRD.md section 10, « Gestion des images »). Ne conserve
 * jamais un chemin local temporaire comme référence persistante : `onChange`
 * n'est appelé qu'avec l'URL distante renvoyée par l'API après téléversement.
 */
export function useCoverPicker({ householdId, value, onChange }: UseCoverPickerOptions) {
  const uploadMutation = useUploadCover(householdId);
  const deleteMutation = useDeleteUpload(householdId);
  const [localPreviewUri, setLocalPreviewUri] = useState<string | null>(null);
  const [uploadedId, setUploadedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    setLocalPreviewUri(asset.uri);

    if (process.env.NODE_ENV !== 'production') {
      console.warn('[useCoverPicker] asset picked', {
        uriScheme: asset.uri.split(':')[0],
        hasHouseholdId: Boolean(householdId),
      });
    }

    try {
      const uploaded = await uploadMutation.mutateAsync({ uri: asset.uri });
      setUploadedId(uploaded.id);
      onChange(uploaded.url);
    } catch (uploadError) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[useCoverPicker] upload failed', {
          errorType:
            uploadError instanceof Error ? uploadError.constructor.name : typeof uploadError,
          message: uploadError instanceof Error ? uploadError.message : String(uploadError),
        });
      }
      setLocalPreviewUri(null);
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
    await uploadAsset(result.asset);
  };

  const pickFromCamera = async () => {
    setError(null);
    const result = await pickImageFromCamera();
    if (result.status === 'denied' || result.status === 'failed') {
      setError(result.message);
      return;
    }
    if (result.status === 'cancelled') return;
    await uploadAsset(result.asset);
  };

  const removeImage = async () => {
    setError(null);
    if (uploadedId) {
      await deleteMutation.mutateAsync(uploadedId).catch(() => {
        /* si la suppression distante échoue, on retire quand même localement */
      });
    }
    setUploadedId(null);
    setLocalPreviewUri(null);
    onChange('');
  };

  /** Décharge l'état local (Bloc 4, reset du formulaire Ajouter) sans appel réseau. */
  const reset = () => {
    setLocalPreviewUri(null);
    setUploadedId(null);
    setError(null);
  };

  return {
    previewUri: value || localPreviewUri,
    isUploading: uploadMutation.isPending,
    isRemoving: deleteMutation.isPending,
    error,
    pickFromLibrary,
    pickFromCamera,
    removeImage,
    reset,
  };
}
