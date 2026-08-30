import { ApiError, NetworkError } from '@notre-nid/api-client';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

import { useDeleteUpload, useUploadCover } from '../../hooks/useUploads';
import { getErrorMessage } from '../../lib/errorMessage';

/**
 * DIAGNOSTIC TEMPORAIRE (bug d'upload de couverture sur build preview) : les
 * `console.warn` gardés par `NODE_ENV !== 'production'` ne s'exécutent jamais
 * dans un bundle JS de production (preview/production EAS), donc invisibles
 * même avec un appareil branché. Cette fonction rend la cause technique
 * exacte visible directement dans l'UI (voir `setError` ci-dessous). À
 * retirer une fois la cause du bug confirmée — ne jamais logguer/afficher
 * tokens, secrets, ni contenu binaire.
 */
function describeUploadErrorForDebug(error: unknown): string {
  if (error instanceof ApiError) {
    return `API ${error.statusCode} ${error.code}: ${error.message}`;
  }
  if (error instanceof NetworkError) {
    const cause = error.cause;
    if (cause instanceof Error) return `fetch ${cause.name}: ${cause.message}`;
    return `fetch: ${String(cause)}`;
  }
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

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
    let asset: ImagePicker.ImagePickerAsset;
    try {
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
      asset = result.assets[0];
    } catch (pickerError) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[useCoverPicker] picker failed', {
          errorType:
            pickerError instanceof Error ? pickerError.constructor.name : typeof pickerError,
          message: pickerError instanceof Error ? pickerError.message : String(pickerError),
        });
      }
      setError(getErrorMessage(pickerError));
      return;
    }

    setLocalPreviewUri(asset.uri);

    if (process.env.NODE_ENV !== 'production') {
      console.warn('[useCoverPicker] asset picked', {
        uriScheme: asset.uri.split(':')[0],
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        hasHouseholdId: Boolean(householdId),
      });
    }

    try {
      const uploaded = await uploadMutation.mutateAsync({
        uri: asset.uri,
        name: asset.fileName ?? 'cover.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
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
      // DIAGNOSTIC TEMPORAIRE : détail technique ajouté au message affiché — retirer
      // `debugDetail` une fois la cause confirmée (voir describeUploadErrorForDebug).
      const debugDetail = describeUploadErrorForDebug(uploadError);
      const assetSummary = `uri=${asset.uri.split(':')[0]}://… name=${asset.fileName ?? '∅'} type=${asset.mimeType ?? '∅'} size=${asset.fileSize ?? '∅'}`;
      setError(`${getErrorMessage(uploadError)} [DEBUG: ${debugDetail} | ${assetSummary}]`);
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
