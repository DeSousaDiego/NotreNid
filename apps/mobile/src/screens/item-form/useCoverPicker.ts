import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

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

  const pickImage = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Accédez à vos photos depuis les réglages pour choisir une couverture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setLocalPreviewUri(asset.uri);

    try {
      const uploaded = await uploadMutation.mutateAsync({
        uri: asset.uri,
        name: asset.fileName ?? 'cover.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      setUploadedId(uploaded.id);
      onChange(uploaded.url);
    } catch (uploadError) {
      setLocalPreviewUri(null);
      setError(getErrorMessage(uploadError));
    }
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

  return {
    previewUri: value || localPreviewUri,
    isUploading: uploadMutation.isPending,
    isRemoving: deleteMutation.isPending,
    error,
    pickImage,
    removeImage,
  };
}
