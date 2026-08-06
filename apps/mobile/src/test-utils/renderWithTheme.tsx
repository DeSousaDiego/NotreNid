import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ThemeProvider } from '../theme';

export function renderWithTheme(ui: ReactElement, options?: RenderOptions) {
  return render(<ThemeProvider fontsLoaded={false}>{ui}</ThemeProvider>, options);
}
