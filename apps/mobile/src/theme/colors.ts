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
  /**
   * Surfaces teintées douces (sauge, pêche, miel) — dérivées du vert forêt, du
   * terracotta et de l'accent miel. Réservées aux fonds (tuiles, pastilles,
   * couvertures de repli), jamais au texte : `text`/`primary` y restent lisibles.
   */
  tintSage: '#E4EDD9',
  tintPeach: '#FBE2D0',
  tintHoney: '#F8E9C6',
  /** Texte/icônes affichés sur un fond `primary` ou `secondary` (contraste). */
  onPrimary: '#FFFCF4',
} as const;

export type ColorToken = keyof typeof colors;
