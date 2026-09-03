import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createMockApiClient } from '../test-utils/mockApiClient';
import { createQueryWrapper } from '../test-utils/queryWrapper';

import { useRemoveAvatar, useUpdateProfile, useUploadAvatar } from './useProfileMutations';

const mockApiClient = createMockApiClient();
const mockRefreshUser = jest.fn();

jest.mock('../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
  useAuth: () => ({ user: { id: 'user-1' }, refreshUser: mockRefreshUser }),
}));

jest.mock('../providers/HouseholdProvider', () => ({
  useHousehold: () => ({ householdId: 'household-1' }),
}));

const FRESH_USER = {
  id: 'user-1',
  email: 'alix@example.com',
  displayName: 'Alix Barbosa',
  avatarUrl: 'https://cdn.test/avatar.jpg',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('useProfileMutations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('useUpdateProfile refreshes the session and invalidates members/items for the current household', async () => {
    (mockApiClient.users.updateProfile as jest.Mock).mockResolvedValue(FRESH_USER);
    const { queryClient, wrapper } = createQueryWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = await renderHook(() => useUpdateProfile(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ displayName: 'Alix Barbosa' });
    });

    expect(mockApiClient.users.updateProfile).toHaveBeenCalledWith({ displayName: 'Alix Barbosa' });
    await waitFor(() => expect(mockRefreshUser).toHaveBeenCalledWith(FRESH_USER));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['users', 'user-1', 'households', 'household-1', 'members'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['users', 'user-1', 'households', 'household-1', 'items'],
    });
  });

  it('useUploadAvatar uploads the file and refreshes the session with the returned user', async () => {
    (mockApiClient.users.uploadAvatar as jest.Mock).mockResolvedValue(FRESH_USER);
    const { wrapper } = createQueryWrapper();

    const { result } = await renderHook(() => useUploadAvatar(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ uri: 'file:///tmp/photo.jpg' });
    });

    expect(mockApiClient.users.uploadAvatar).toHaveBeenCalledWith(expect.any(FormData));
    await waitFor(() => expect(mockRefreshUser).toHaveBeenCalledWith(FRESH_USER));
  });

  it('useRemoveAvatar clears the photo and refreshes the session', async () => {
    const clearedUser = { ...FRESH_USER, avatarUrl: null };
    (mockApiClient.users.removeAvatar as jest.Mock).mockResolvedValue(clearedUser);
    const { wrapper } = createQueryWrapper();

    const { result } = await renderHook(() => useRemoveAvatar(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockApiClient.users.removeAvatar).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockRefreshUser).toHaveBeenCalledWith(clearedUser));
  });
});
