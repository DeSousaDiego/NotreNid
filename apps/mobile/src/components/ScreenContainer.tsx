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

/** Conteneur d'écran standard : fond crème, safe area, padding cohérent. */
export function ScreenContainer({
  children,
  edges = ['top', 'left', 'right'],
  scroll = false,
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
