import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

/**
 * Hauteur du contenu de la tab bar (icône + libellé + paddings), hors zone de
 * sécurité — Expo Router ne rend pas `useBottomTabBarHeight` (React Navigation)
 * accessible ici (`@react-navigation/bottom-tabs` n'est pas une dépendance directe
 * résolvable dans cette disposition pnpm) ; combinée à `insets.bottom`, seule
 * partie réellement variable selon l'appareil, cette estimation reste bien plus
 * fiable qu'une unique valeur fixe (Bloc 4, correctif « dernier item masqué »).
 */
const TAB_BAR_CONTENT_HEIGHT = 56;

/** Marge basse à réserver dans le contenu défilant d'un écran d'onglet, pour que
 * son dernier élément ne se retrouve jamais partiellement sous la tab bar. */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  return insets.bottom + TAB_BAR_CONTENT_HEIGHT + theme.spacing.sm;
}
