import { act, renderHook } from '@testing-library/react-native';
import { File } from 'expo-file-system';

import { createMockApiClient } from '../test-utils/mockApiClient';
import { createQueryWrapper } from '../test-utils/queryWrapper';

import { useDeleteUpload, useUploadCover } from './useUploads';

const mockApiClient = createMockApiClient();

jest.mock('../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
}));

const HOUSEHOLD_ID = 'h1';

describe('useUploads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('useUploadCover wraps the local URI in a real File (Blob-compatible) and uploads it', async () => {
    // Expo's global fetch only recognizes string, Blob, or `.bytes()`-capable parts in a
    // FormData — the historical React Native `{ uri, name, type }` object throws
    // "Unsupported FormDataPart implementation" (see useUploads.ts for the full story).
    (mockApiClient.uploads.upload as jest.Mock).mockResolvedValue({
      id: 'file-1',
      url: 'http://api.test/uploads/file-1.jpg',
    });
    const appendSpy = jest.spyOn(FormData.prototype, 'append');
    const { wrapper } = createQueryWrapper();

    const { result } = await renderHook(() => useUploadCover(HOUSEHOLD_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ uri: 'file:///tmp/cover.jpg' });
    });

    expect(appendSpy).toHaveBeenCalledWith('file', expect.any(File));
    const [, uploadedPart] = appendSpy.mock.calls[0] as [string, File];
    expect(uploadedPart.uri).toBe('file:///tmp/cover.jpg');
    expect(uploadedPart.name).toBe('cover.jpg');
    expect(mockApiClient.uploads.upload).toHaveBeenCalledWith(HOUSEHOLD_ID, expect.any(FormData));
    appendSpy.mockRestore();
  });

  it('useUploadCover rejects without calling the API when no household is selected', async () => {
    const { wrapper } = createQueryWrapper();

    const { result } = await renderHook(() => useUploadCover(null), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ uri: 'file:///tmp/cover.jpg' })).rejects.toThrow();
    });

    expect(mockApiClient.uploads.upload).not.toHaveBeenCalled();
  });

  it('useDeleteUpload rejects without calling the API when no household is selected', async () => {
    const { wrapper } = createQueryWrapper();

    const { result } = await renderHook(() => useDeleteUpload(null), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync('file-1')).rejects.toThrow();
    });

    expect(mockApiClient.uploads.remove).not.toHaveBeenCalled();
  });

  it('useDeleteUpload forwards the upload id', async () => {
    (mockApiClient.uploads.remove as jest.Mock).mockResolvedValue(undefined);
    const { wrapper } = createQueryWrapper();

    const { result } = await renderHook(() => useDeleteUpload(HOUSEHOLD_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('file-1');
    });

    expect(mockApiClient.uploads.remove).toHaveBeenCalledWith(HOUSEHOLD_ID, 'file-1');
  });
});
