import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { colors } from './colors';
import { elevation } from './elevation';
import { durations, iconSizes, radii, spacing } from './spacing';
import { fontFamilies, fontFamiliesFallback, typography } from './typography';

export interface Theme {
  colors: typeof colors;
  spacing: typeof spacing;
  radii: typeof radii;
  iconSizes: typeof iconSizes;
  durations: typeof durations;
  elevation: typeof elevation;
  typography: typeof typography;
  /** Vrai une fois Nunito Sans chargée : sinon on utilise le repli système. */
  fontsLoaded: boolean;
  fonts: typeof fontFamilies | typeof fontFamiliesFallback;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({
  fontsLoaded,
  children,
}: {
  fontsLoaded: boolean;
  children: ReactNode;
}) {
  const value = useMemo<Theme>(
    () => ({
      colors,
      spacing,
      radii,
      iconSizes,
      durations,
      elevation,
      typography,
      fontsLoaded,
      fonts: fontsLoaded ? fontFamilies : fontFamiliesFallback,
    }),
    [fontsLoaded],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme doit être utilisé à l’intérieur de <ThemeProvider>.');
  }
  return theme;
}
