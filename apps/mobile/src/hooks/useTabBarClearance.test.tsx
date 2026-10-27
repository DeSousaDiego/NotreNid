import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ThemeProvider } from '../theme';

import { useTabBarClearance } from './useTabBarClearance';

let mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider fontsLoaded={false}>{children}</ThemeProvider>;
}

describe('useTabBarClearance', () => {
  it('grows with the device safe area inset rather than staying a fixed value', async () => {
    mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };
    const { result: withoutGesture } = await renderHook(() => useTabBarClearance(), { wrapper });

    mockInsets = { top: 0, right: 0, bottom: 34, left: 0 };
    const { result: withGesture } = await renderHook(() => useTabBarClearance(), { wrapper });

    expect(withGesture.current).toBeGreaterThan(withoutGesture.current);
    expect(withGesture.current - withoutGesture.current).toBe(34);
  });

  it('always reserves more than just the safe area inset (room for the tab bar itself)', async () => {
    mockInsets = { top: 0, right: 0, bottom: 20, left: 0 };
    const { result } = await renderHook(() => useTabBarClearance(), { wrapper });

    expect(result.current).toBeGreaterThan(20);
  });
});
