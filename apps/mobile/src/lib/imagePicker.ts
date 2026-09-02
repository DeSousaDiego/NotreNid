import * as ImagePicker from 'expo-image-picker';

import { getErrorMessage } from './errorMessage';

export type PickImageResult =
  | { status: 'picked'; asset: ImagePicker.ImagePickerAsset }
  | { status: 'cancelled' }
  | { status: 'denied'; message: string }
  | { status: 'failed'; message: string };

/**
 * Logique de sélection d'image partagée (permission + lancement du picker) entre la
 * couverture d'un item (`useCoverPicker`, scope household) et la photo de profil
 * (`useAvatarPicker`, scope utilisateur) — seule la destination de l'upload diffère
 * entre les deux, pas la façon d'obtenir l'image (docs/PHASE_STATUS.md, Bloc 4).
 * La demande de permission et le lancement du picker natif peuvent tous deux rejeter
 * (module natif indisponible, picker qui crashe) — capturé ici une bonne fois pour
 * toutes plutôt que dans chaque appelant.
 */
export async function pickImageFromLibrary(): Promise<PickImageResult> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return {
        status: 'denied',
        message: 'Accédez à vos photos depuis les réglages pour choisir une image.',
      };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return { status: 'cancelled' };
    return { status: 'picked', asset: result.assets[0] };
  } catch (pickerError) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[imagePicker] library picker failed', {
        errorType: pickerError instanceof Error ? pickerError.constructor.name : typeof pickerError,
        message: pickerError instanceof Error ? pickerError.message : String(pickerError),
      });
    }
    return { status: 'failed', message: getErrorMessage(pickerError) };
  }
}

export async function pickImageFromCamera(): Promise<PickImageResult> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return {
        status: 'denied',
        message: permission.canAskAgain
          ? 'La caméra est nécessaire pour prendre une photo.'
          : "La caméra est nécessaire pour prendre une photo. Activez-la depuis les réglages de l'application.",
      };
    }

    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return { status: 'cancelled' };
    return { status: 'picked', asset: result.assets[0] };
  } catch (pickerError) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[imagePicker] camera picker failed', {
        errorType: pickerError instanceof Error ? pickerError.constructor.name : typeof pickerError,
        message: pickerError instanceof Error ? pickerError.message : String(pickerError),
      });
    }
    return { status: 'failed', message: getErrorMessage(pickerError) };
  }
}
