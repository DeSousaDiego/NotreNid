import { act, renderHook } from '@testing-library/react-native';

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

  it('useUploadCover builds a FormData with the local file and uploads it', async () => {
    (mockApiClient.uploads.upload as jest.Mock).mockResolvedValue({
      id: 'file-1',
      url: 'http://api.test/uploads/file-1.jpg',
    });
    const appendSpy = jest.spyOn(FormData.prototype, 'append');
    const { wrapper } = createQueryWrapper();

    const { result } = await renderHook(() => useUploadCover(HOUSEHOLD_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        uri: 'file:///tmp/cover.jpg',
        name: 'cover.jpg',
        type: 'image/jpeg',
      });
    });

    expect(appendSpy).toHaveBeenCalledWith('file', {
      uri: 'file:///tmp/cover.jpg',
      name: 'cover.jpg',
      type: 'image/jpeg',
    });
    expect(mockApiClient.uploads.upload).toHaveBeenCalledWith(HOUSEHOLD_ID, expect.any(FormData));
    appendSpy.mockRestore();
  });

  it('useUploadCover rejects without calling the API when no household is selected', async () => {
    const { wrapper } = createQueryWrapper();

    const { result } = await renderHook(() => useUploadCover(null), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          uri: 'file:///tmp/cover.jpg',
          name: 'cover.jpg',
          type: 'image/jpeg',
        }),
      ).rejects.toThrow();
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
