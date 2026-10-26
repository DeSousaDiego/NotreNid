import { renderHook } from '@testing-library/react-native';
import { BottomTabBarHeightContext } from 'expo-router/build/react-navigation/bottom-tabs/utils/BottomTabBarHeightContext';
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

  describe('inside a tab screen', () => {
    function tabWrapper(tabBarHeight: number) {
      return function TabWrapper({ children }: { children: ReactNode }) {
        return (
          <BottomTabBarHeightContext.Provider value={tabBarHeight}>
            <ThemeProvider fontsLoaded={false}>{children}</ThemeProvider>
          </BottomTabBarHeightContext.Provider>
        );
      };
    }

    it('uses the real measured tab bar height (system area included), plus a small spacing', async () => {
      // 3-button navigation: 49 pt of bar + 48 pt of system area, as Expo Router measures it.
      mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };
      const { result } = await renderHook(() => useTabBarClearance(), {
        wrapper: tabWrapper(97),
      });

      expect(result.current).toBe(97 + 8);
    });

    it('never relies on the inset estimate when the real height is known', async () => {
      // `insets.bottom` ~0 in nested tab screens used to produce 64 pt, under the 97-pt bar.
      mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };
      const { result: estimated } = await renderHook(() => useTabBarClearance(), { wrapper });
      const { result: measured } = await renderHook(() => useTabBarClearance(), {
        wrapper: tabWrapper(97),
      });

      expect(estimated.current).toBe(64);
      expect(measured.current).toBeGreaterThan(97);
    });
  });
});
