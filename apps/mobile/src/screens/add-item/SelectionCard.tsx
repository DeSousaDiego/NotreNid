import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../../components';
import { useTheme } from '../../theme';

export interface SelectionCardProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
}

/**
 * Grande carte pressable pour un choix binaire/ternaire (catégorie, mode d'ajout) —
 * aucun équivalent n'existait avant le Bloc 2 (`CategoryPicker` est une petite puce,
 * `ItemCard` n'a pas d'état sélectionnable). Reprend les conventions visuelles déjà
 * établies (`ItemCard`, `CategoryPicker`) plutôt qu'une nouvelle identité.
 */
export function SelectionCard({
  title,
  subtitle,
  icon,
  onPress,
  accessibilityLabel,
}: SelectionCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.lg,
          padding: theme.spacing.lg,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.85 : 1,
        },
        theme.elevation.low,
      ]}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="section">{title}</AppText>
        {subtitle ? (
          <AppText variant="body" color="textMuted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}
