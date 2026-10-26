// Expo Router 57 embarque sa propre copie de la tab bar React Navigation (pas de
// dépendance `@react-navigation/bottom-tabs`) ; ce contexte n'est pas réexporté par
// son point d'entrée public, d'où ce chemin interne — le package n'a pas de champ
// `exports`, et un renommage lors d'une montée de version casserait le typecheck et
// les tests, jamais silencieusement.
import { BottomTabBarHeightContext } from 'expo-router/build/react-navigation/bottom-tabs/utils/BottomTabBarHeightContext';
import { useContext } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

/**
 * Repli seulement (hors d'un écran d'onglet, où le contexte n'existe pas) : hauteur
 * estimée du contenu de la tab bar, hors zone système.
 */
const TAB_BAR_CONTENT_HEIGHT = 56;

/**
 * Marge basse à réserver dans le contenu défilant d'un écran d'onglet, pour que son
 * dernier élément ne se retrouve jamais sous la tab bar (validé sur téléphone : elle
 * recouvre le bas des écrans d'onglet). Basée sur la hauteur RÉELLE de la tab bar,
 * mesurée par Expo Router (zone système incluse) : l'ancienne estimation
 * `insets.bottom + 56` sous-estimait la barre — `insets.bottom` vaut ~0 dans ces
 * écrans imbriqués alors que la barre ajoute la vraie zone système (48 px avec la
 * navigation à 3 boutons), d'où une dernière carte de Collection légèrement coupée.
 */
export function useTabBarClearance(): number {
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  if (tabBarHeight !== undefined) return tabBarHeight + theme.spacing.sm;
  return insets.bottom + TAB_BAR_CONTENT_HEIGHT + theme.spacing.sm;
}
