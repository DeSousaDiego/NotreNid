import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

/**
 * Hauteur estimée du contenu de la tab bar (icône + libellé + paddings), hors zone
 * de sécurité ; combinée à `insets.bottom` (Bloc 4, correctif « dernier item
 * masqué »). Utilisée par l'Accueil et le Profil, validés sur téléphone avec cette
 * valeur. La Collection n'en a pas besoin : sa FlatList est contrainte à la hauteur
 * visible (`flex: 1`) et se termine déjà au-dessus de la tab bar.
 */
const TAB_BAR_CONTENT_HEIGHT = 56;

/** Marge basse à réserver dans le contenu défilant d'un écran d'onglet, pour que
 * son dernier élément ne se retrouve jamais partiellement sous la tab bar. */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  return insets.bottom + TAB_BAR_CONTENT_HEIGHT + theme.spacing.sm;
}
