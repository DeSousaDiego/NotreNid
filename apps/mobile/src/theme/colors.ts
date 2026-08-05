/**
 * Palette sémantique « Notre Nid » (docs/NOTRE_NID_PRD.md section 4.4).
 * Aucun composant ne doit contenir de couleur écrite en dur : toujours
 * passer par ces tokens.
 */
export const colors = {
  background: '#FFF8E8',
  surface: '#FFFCF4',
  primary: '#355A3A',
  primaryMuted: '#8CA879',
  secondary: '#E9782F',
  accent: '#EBA94B',
  text: '#26312A',
  textMuted: '#687269',
  border: '#D8E2D1',
  danger: '#A64236',
  /** Texte/icônes affichés sur un fond `primary` ou `secondary` (contraste). */
  onPrimary: '#FFFCF4',
} as const;

export type ColorToken = keyof typeof colors;
