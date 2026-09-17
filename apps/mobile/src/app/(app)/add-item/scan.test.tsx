import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '../../../theme';

import AddItemScanScreen from './scan';

// `scan.tsx` importe le barrel `components`, qui charge `Avatar`/`ItemCard` et donc
// `expo-image` transitivement — sa sonde d'analytics au niveau module n'est pas
// compatible avec cet environnement Jest (même convention que les autres écrans).
jest.mock('expo-image', () => ({ Image: () => null }));

const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockRouterReplace(...args) },
  useLocalSearchParams: () => ({ categoryId: 'cat-cd' }),
}));

describe('AddItemScanScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a minimal placeholder message', async () => {
    const view = await render(
      <ThemeProvider fontsLoaded={false}>
        <AddItemScanScreen />
      </ThemeProvider>,
    );

    expect(view.getByText('Le scanner arrive bientôt')).toBeTruthy();
  });

  it('falls back to the manual form, carrying the categoryId along', async () => {
    const view = await render(
      <ThemeProvider fontsLoaded={false}>
        <AddItemScanScreen />
      </ThemeProvider>,
    );

    await fireEvent.press(view.getByRole('button', { name: 'Saisir manuellement à la place' }));

    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith({
        pathname: '/(app)/add-item/form',
        params: { categoryId: 'cat-cd' },
      }),
    );
  });
});
