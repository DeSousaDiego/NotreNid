import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

export interface ScreenContainerProps {
  children: ReactNode;
  edges?: Edge[];
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

/** Conteneur d'écran standard : fond crème, safe area, padding cohérent. */
export function ScreenContainer({
  children,
  edges = ['top', 'left', 'right'],
  style,
  contentStyle,
}: ScreenContainerProps) {
  const theme = useTheme();

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.flex, { backgroundColor: theme.colors.background }, style]}
    >
      <View style={[styles.content, { padding: theme.spacing.lg }, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1 },
});
