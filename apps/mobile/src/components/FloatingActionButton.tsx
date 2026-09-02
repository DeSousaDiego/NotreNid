import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { useTheme } from '../theme';

export interface FloatingActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
}

const SIZE = 56;

/**
 * Bouton d'action principal rond et proéminent (mock-up Notre Nid — ex. « Modifier
 * cet item »), à positionner en `position: 'absolute'` par un parent relatif.
 * Icône seule : `accessibilityLabel` obligatoire.
 */
export function FloatingActionButton({
  icon,
  onPress,
  accessibilityLabel,
  disabled = false,
}: FloatingActionButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          position: 'absolute',
          right: theme.spacing.xl,
          bottom: theme.spacing.xl,
          width: SIZE,
          height: SIZE,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors.secondary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        theme.elevation.medium,
      ]}
    >
      <Ionicons name={icon} size={theme.iconSizes.lg} color={theme.colors.onPrimary} />
    </Pressable>
  );
}
