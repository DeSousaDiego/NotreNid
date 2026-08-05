import { Platform } from 'react-native';

/**
 * Polices « Notre Nid » (docs/NOTRE_NID_PRD.md section 4.5) : Nunito Sans,
 * uniquement regular/medium/semibold pour l'interface, avec repli système.
 */
export const fontFamilies = {
  regular: 'NunitoSans_400Regular',
  medium: 'NunitoSans_500Medium',
  semiBold: 'NunitoSans_600SemiBold',
} as const;

const systemFallback = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

/** À utiliser tant que les polices ne sont pas encore chargées (voir ThemeProvider). */
export const fontFamiliesFallback = {
  regular: systemFallback,
  medium: systemFallback,
  semiBold: systemFallback,
} as const;

export interface TypographyVariant {
  fontSize: number;
  lineHeight: number;
  fontFamilyKey: keyof typeof fontFamilies;
}

/** Échelle typographique centralisée (display, title, section, body, label, caption, helper). */
export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontFamilyKey: 'semiBold' },
  title: { fontSize: 24, lineHeight: 32, fontFamilyKey: 'semiBold' },
  section: { fontSize: 18, lineHeight: 26, fontFamilyKey: 'semiBold' },
  body: { fontSize: 16, lineHeight: 24, fontFamilyKey: 'regular' },
  label: { fontSize: 14, lineHeight: 20, fontFamilyKey: 'medium' },
  caption: { fontSize: 12, lineHeight: 16, fontFamilyKey: 'regular' },
  helper: { fontSize: 12, lineHeight: 16, fontFamilyKey: 'regular' },
} as const satisfies Record<string, TypographyVariant>;

export type TypographyToken = keyof typeof typography;
