/** Grille d'espacement basée sur 4 points (docs/NOTRE_NID_PRD.md section 4.6). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export type SpacingToken = keyof typeof spacing;

/** Rayons modérés et organiques. */
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export type RadiusToken = keyof typeof radii;

export const iconSizes = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export type IconSizeToken = keyof typeof iconSizes;

/** Durées d'animation courtes et discrètes (section 4.9). */
export const durations = {
  fast: 150,
  base: 250,
  slow: 400,
} as const;

export type DurationToken = keyof typeof durations;
