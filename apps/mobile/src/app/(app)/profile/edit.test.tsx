import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ToastProvider } from '../../../components';
import { ThemeProvider } from '../../../theme';

import EditProfileScreen from './edit';

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

const mockApiClient = createMockApiClient();
const mockRefreshUser = jest.fn();
let mockUser: {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

jest.mock('../../../providers/AuthProvider', () => ({
  useApiClient: () => mockApiClient,
  useAuth: () => ({ user: mockUser, refreshUser: mockRefreshUser }),
}));

jest.mock('../../../providers/HouseholdProvider', () => ({
  useHousehold: () => ({ householdId: 'household-1' }),
}));

const mockRouterBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { back: () => mockRouterBack() },
}));

function createMockApiClient() {
  return {
    users: {
      updateProfile: jest.fn(),
      uploadAvatar: jest.fn(),
      removeAvatar: jest.fn(),
    },
  } as unknown as import('@notre-nid/api-client').ApiClient;
}

function renderScreen(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider fontsLoaded={false}>
        <ToastProvider>{ui}</ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('EditProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = {
      id: 'user-1',
      email: 'alix@example.com',
      displayName: 'Alix',
      avatarUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
  });

  it('prefills the display name and shows the email as read-only', async () => {
    const view = await renderScreen(<EditProfileScreen />);

    expect(view.getByLabelText('Nom affiché').props.value).toBe('Alix');
    expect(view.getByText('alix@example.com')).toBeTruthy();
  });

  it('saves the new display name, shows a success toast and navigates back', async () => {
    (mockApiClient.users.updateProfile as jest.Mock).mockResolvedValue({
      ...mockUser,
      displayName: 'Alix Barbosa',
    });
    const view = await renderScreen(<EditProfileScreen />);

    await fireEvent.changeText(view.getByLabelText('Nom affiché'), 'Alix Barbosa');
    await fireEvent.press(view.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() =>
      expect(mockApiClient.users.updateProfile).toHaveBeenCalledWith({
        displayName: 'Alix Barbosa',
      }),
    );
    await waitFor(() => expect(view.getByText('Votre profil a été mis à jour.')).toBeTruthy());
    await waitFor(() => expect(mockRouterBack).toHaveBeenCalledTimes(1));
  });

  it('rejects an empty display name without calling the API', async () => {
    const view = await renderScreen(<EditProfileScreen />);

    await fireEvent.changeText(view.getByLabelText('Nom affiché'), '   ');
    await fireEvent.press(view.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(view.getByText('Le nom est requis.')).toBeTruthy());
    expect(mockApiClient.users.updateProfile).not.toHaveBeenCalled();
  });

  it('only offers to remove the photo when one is already set', async () => {
    const withoutPhoto = await renderScreen(<EditProfileScreen />);
    await fireEvent.press(withoutPhoto.getByLabelText('Changer la photo de profil'));
    await waitFor(() => expect(withoutPhoto.getByText('Prendre une photo')).toBeTruthy());
    expect(withoutPhoto.queryByText('Retirer la photo')).toBeNull();

    mockUser = { ...mockUser, avatarUrl: 'https://cdn.test/avatar.jpg' };
    const withPhoto = await renderScreen(<EditProfileScreen />);
    await fireEvent.press(withPhoto.getByLabelText('Changer la photo de profil'));
    await waitFor(() => expect(withPhoto.getByText('Retirer la photo')).toBeTruthy());
  });
});
