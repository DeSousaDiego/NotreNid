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
}));

const ImagePicker = jest.requireMock('expo-image-picker') as {
  requestMediaLibraryPermissionsAsync: jest.Mock;
  launchImageLibraryAsync: jest.Mock;
};

const HOUSEHOLD_ID = 'h1';

describe('useCoverPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
      await result.current.pickImage();
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
      await result.current.pickImage();
    });

    expect(result.current.error).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    expect(mockApiClient.uploads.upload).not.toHaveBeenCalled();
  });

  it('still uploads normally when the picker succeeds', async () => {
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/cover.jpg', fileName: 'cover.jpg', mimeType: 'image/jpeg' }],
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
      await result.current.pickImage();
    });

    expect(result.current.error).toBeNull();
    expect(onChange).toHaveBeenCalledWith('http://api.test/uploads/file-1.jpg');
  });
});
