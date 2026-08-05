import { Platform } from 'react-native';
import type { ViewStyle } from 'react-native';

/**
 * Ombres très légères, réservées aux éléments qui doivent apparaître au-dessus
 * du plan courant (docs/NOTRE_NID_PRD.md section 4.3).
 */
function shadow(opacity: number, radius: number, elevation: number): ViewStyle {
  return Platform.select<ViewStyle>({
    android: { elevation },
    default: {
      shadowColor: '#26312A',
      shadowOffset: { width: 0, height: elevation / 2 },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
  })!;
}

export const elevation = {
  none: {} as ViewStyle,
  low: shadow(0.06, 4, 2),
  medium: shadow(0.1, 8, 4),
} as const;

export type ElevationToken = keyof typeof elevation;
