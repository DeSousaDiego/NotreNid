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
}

/** Conteneur d'écran standard : fond crème, safe area, padding cohérent. */
export function ScreenContainer({
  children,
  edges = ['top', 'left', 'right'],
  scroll = false,
  style,
  contentStyle,
}: ScreenContainerProps) {
  const theme = useTheme();

  const content = scroll ? (
    <ScrollView
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
});
