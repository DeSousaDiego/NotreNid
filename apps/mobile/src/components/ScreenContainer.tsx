import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

export interface ScreenContainerProps {
  children: ReactNode;
  edges?: Edge[];
  /** Enveloppe le contenu dans un ScrollView + évitement clavier (formulaires). */
  scroll?: boolean;
  /**
   * Comportement de `KeyboardAvoidingView` sur Android — aucun par défaut (comportement
   * historique inchangé pour ne pas affecter les écrans qui ne l'activent pas). iOS utilise
   * toujours `"padding"`, indépendamment de cette prop.
   *
   * Sur Android récent (edge-to-edge obligatoire depuis Expo SDK 54), l'app dessine derrière
   * la barre de navigation et le clavier : `windowSoftInputMode="adjustResize"` ne redimensionne
   * plus réellement la fenêtre, donc sans ce comportement explicite rien ne réserve de place
   * pour le clavier et le champ actif peut se retrouver masqué. `"height"` correspond à
   * l'exemple canonique de la documentation React Native pour Android.
   */
  androidKeyboardBehavior?: 'height' | 'padding';
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  /**
   * Zone fixe sous le contenu, hors ScrollView — pour une action qui doit rester
   * visible en permanence sans dépendre du scroll (ex. "Appliquer les filtres").
   * Rendu comme un frère du ScrollView, pas en overlay : le layout flex réserve
   * déjà sa hauteur, donc `contentStyle` n'a besoin que d'une petite marge de fin
   * de liste (`spacing.sm`/`md`) — pas de compenser la hauteur du footer, qui
   * créerait un vide en bas une fois le scroll arrivé au bout. Le fournisseur
   * gère lui-même son padding bas (`useSafeAreaInsets().bottom`).
   */
  footer?: ReactNode;
}

/**
 * iOS utilise toujours `"padding"`. Android n'a de comportement que si l'écran
 * l'active explicitement via `androidKeyboardBehavior` (voir sa documentation
 * ci-dessus) — extrait en fonction pure pour rester testable sans dépendre du
 * rendu (le renderer de test n'expose que les éléments hôtes, pas les props
 * internes d'un composant composite comme `KeyboardAvoidingView`).
 */
export function resolveKeyboardAvoidingBehavior(
  androidKeyboardBehavior: ScreenContainerProps['androidKeyboardBehavior'],
): 'padding' | 'height' | undefined {
  return Platform.OS === 'ios' ? 'padding' : androidKeyboardBehavior;
}

/** Conteneur d'écran standard : fond crème, safe area, padding cohérent. */
export function ScreenContainer({
  children,
  edges = ['top', 'left', 'right'],
  scroll = false,
  androidKeyboardBehavior,
  style,
  contentStyle,
  footer,
}: ScreenContainerProps) {
  const theme = useTheme();

  const content = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { padding: theme.spacing.lg }, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, { padding: theme.spacing.lg }, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.flex, { backgroundColor: theme.colors.background }, style]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={resolveKeyboardAvoidingBehavior(androidKeyboardBehavior)}
      >
        {content}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
});
