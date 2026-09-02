import { act, renderHook } from '@testing-library/react-native';

import { createMockApiClient } from '../../test-utils/mockApiClient';
import { createQueryWrapper } from '../../test-utils/queryWrapper';

import { useCoverPicker } from './useCoverPicker';

const mockApiClient = createMockApiClient();

jest.mock('../../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

const ImagePicker = jest.requireMock('expo-image-picker') as {
  requestMediaLibraryPermissionsAsync: jest.Mock;
  launchImageLibraryAsync: jest.Mock;
  requestCameraPermissionsAsync: jest.Mock;
  launchCameraAsync: jest.Mock;
};

const HOUSEHOLD_ID = 'h1';

describe('useCoverPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('pickFromLibrary', () => {
    it('surfaces a user-facing error instead of an unhandled rejection when the permission request throws', async () => {
      ImagePicker.requestMediaLibraryPermissionsAsync.mockRejectedValue(
        new Error('native module unavailable'),
      );
      const onChange = jest.fn();
      const { wrapper } = createQueryWrapper();

      const { result } = await renderHook(
        () => useCoverPicker({ householdId: HOUSEHOLD_ID, value: '', onChange }),
        { wrapper },
      );

      await act(async () => {
        await result.current.pickFromLibrary();
      });

      expect(result.current.error).toBeTruthy();
      expect(onChange).not.toHaveBeenCalled();
      expect(mockApiClient.uploads.upload).not.toHaveBeenCalled();
    });

    it('surfaces a user-facing error instead of an unhandled rejection when launching the library throws', async () => {
      ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
      ImagePicker.launchImageLibraryAsync.mockRejectedValue(new Error('picker crashed'));
      const onChange = jest.fn();
      const { wrapper } = createQueryWrapper();

      const { result } = await renderHook(
        () => useCoverPicker({ householdId: HOUSEHOLD_ID, value: '', onChange }),
        { wrapper },
      );

      await act(async () => {
        await result.current.pickFromLibrary();
      });

      expect(result.current.error).toBeTruthy();
      expect(onChange).not.toHaveBeenCalled();
      expect(mockApiClient.uploads.upload).not.toHaveBeenCalled();
    });

    it('does nothing and sets no error when the user cancels the picker', async () => {
      ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
      ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
      const onChange = jest.fn();
      const { wrapper } = createQueryWrapper();

      const { result } = await renderHook(
        () => useCoverPicker({ householdId: HOUSEHOLD_ID, value: '', onChange }),
        { wrapper },
      );

      await act(async () => {
        await result.current.pickFromLibrary();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.previewUri).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
      expect(mockApiClient.uploads.upload).not.toHaveBeenCalled();
    });

    it('uploads a JPEG asset and calls onChange with the remote URL, even without fileName/mimeType from the picker', async () => {
      ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
      ImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        // Android peut ne fournir ni fileName ni mimeType (voir docs/NOTRE_NID_PRD.md
        // section 6) — le nouveau flux ne dépend plus de ces champs (dérivés de l'URI
        // par `File`), donc ce cas doit fonctionner comme les autres.
        assets: [{ uri: 'file:///tmp/1000043961.jpg', fileName: null, mimeType: null }],
      });
      (mockApiClient.uploads.upload as jest.Mock).mockResolvedValue({
        id: 'file-1',
        url: 'http://api.test/uploads/file-1.jpg',
      });
      const onChange = jest.fn();
      const { wrapper } = createQueryWrapper();

      const { result } = await renderHook(
        () => useCoverPicker({ householdId: HOUSEHOLD_ID, value: '', onChange }),
        { wrapper },
      );

      await act(async () => {
        await result.current.pickFromLibrary();
      });

      expect(result.current.error).toBeNull();
      expect(onChange).toHaveBeenCalledWith('http://api.test/uploads/file-1.jpg');
      expect(mockApiClient.uploads.upload).toHaveBeenCalledWith(HOUSEHOLD_ID, expect.any(FormData));
    });

    it('surfaces a user-facing error and clears the local preview when the upload itself fails', async () => {
      ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
      ImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///tmp/cover.jpg', fileName: 'cover.jpg', mimeType: 'image/jpeg' }],
      });
      (mockApiClient.uploads.upload as jest.Mock).mockRejectedValue(
        new Error('Formats acceptés : JPEG, PNG, WebP.'),
      );
      const onChange = jest.fn();
      const { wrapper } = createQueryWrapper();

      const { result } = await renderHook(
        () => useCoverPicker({ householdId: HOUSEHOLD_ID, value: '', onChange }),
        { wrapper },
      );

      await act(async () => {
        await result.current.pickFromLibrary();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.previewUri).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('pickFromCamera', () => {
    it('surfaces a human, actionable error when the camera permission is denied but can be asked again', async () => {
      ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({
        granted: false,
        canAskAgain: true,
      });
      const onChange = jest.fn();
      const { wrapper } = createQueryWrapper();

      const { result } = await renderHook(
        () => useCoverPicker({ householdId: HOUSEHOLD_ID, value: '', onChange }),
        { wrapper },
      );

      await act(async () => {
        await result.current.pickFromCamera();
      });

      // Message générique (Bloc 4) : le picker caméra est désormais partagé entre la
      // couverture d'un item et la photo de profil (lib/imagePicker.ts), donc son texte
      // ne peut plus mentionner "la couverture" spécifiquement.
      expect(result.current.error).toBe('La caméra est nécessaire pour prendre une photo.');
      expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
      expect(mockApiClient.uploads.upload).not.toHaveBeenCalled();
    });

    it('points to the app settings when the camera permission is permanently denied', async () => {
      ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({
        granted: false,
        canAskAgain: false,
      });
      const onChange = jest.fn();
      const { wrapper } = createQueryWrapper();

      const { result } = await renderHook(
        () => useCoverPicker({ householdId: HOUSEHOLD_ID, value: '', onChange }),
        { wrapper },
      );

      await act(async () => {
        await result.current.pickFromCamera();
      });

      expect(result.current.error).toContain('réglages');
    });

    it('does nothing and sets no error when the user cancels the camera', async () => {
      ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
      ImagePicker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null });
      const onChange = jest.fn();
      const { wrapper } = createQueryWrapper();

      const { result } = await renderHook(
        () => useCoverPicker({ householdId: HOUSEHOLD_ID, value: '', onChange }),
        { wrapper },
      );

      await act(async () => {
        await result.current.pickFromCamera();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.previewUri).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
      expect(mockApiClient.uploads.upload).not.toHaveBeenCalled();
    });

    it('uploads a photo taken with the camera through the same pipeline as the gallery', async () => {
      ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
      ImagePicker.launchCameraAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///tmp/photo.jpg', fileName: null, mimeType: null }],
      });
      (mockApiClient.uploads.upload as jest.Mock).mockResolvedValue({
        id: 'file-2',
        url: 'http://api.test/uploads/file-2.jpg',
      });
      const onChange = jest.fn();
      const { wrapper } = createQueryWrapper();

      const { result } = await renderHook(
        () => useCoverPicker({ householdId: HOUSEHOLD_ID, value: '', onChange }),
        { wrapper },
      );

      await act(async () => {
        await result.current.pickFromCamera();
      });

      expect(result.current.error).toBeNull();
      expect(onChange).toHaveBeenCalledWith('http://api.test/uploads/file-2.jpg');
      expect(mockApiClient.uploads.upload).toHaveBeenCalledWith(HOUSEHOLD_ID, expect.any(FormData));
    });

    it('surfaces a user-facing error instead of an unhandled rejection when launching the camera throws', async () => {
      ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
      ImagePicker.launchCameraAsync.mockRejectedValue(new Error('camera crashed'));
      const onChange = jest.fn();
      const { wrapper } = createQueryWrapper();

      const { result } = await renderHook(
        () => useCoverPicker({ householdId: HOUSEHOLD_ID, value: '', onChange }),
        { wrapper },
      );

      await act(async () => {
        await result.current.pickFromCamera();
      });

      expect(result.current.error).toBeTruthy();
      expect(onChange).not.toHaveBeenCalled();
      expect(mockApiClient.uploads.upload).not.toHaveBeenCalled();
    });
  });
});
