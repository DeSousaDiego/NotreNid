import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../../components';
import { useTheme, type ColorToken } from '../../theme';

export interface SelectionCardProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
  /** Surface teintée (tokens `tint*` de l'Accueil) — carte neutre si absent. */
  tint?: ColorToken;
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
  tint,
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
          // Teintée : la couleur remplace la bordure (moins d'effet « rectangle neutre »).
          backgroundColor: tint ? theme.colors[tint] : theme.colors.surface,
          borderWidth: tint ? 0 : 1,
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
          borderRadius: tint ? theme.radii.full : theme.radii.md,
          backgroundColor: tint ? theme.colors.surface : theme.colors.background,
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
