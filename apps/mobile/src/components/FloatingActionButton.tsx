import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

export const FLOATING_ACTION_BUTTON_SIZE = 56;

export interface FloatingActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  /** Fond `secondary` (orange, action principale) ou `primary` (vert forêt, action secondaire). */
  tone?: 'secondary' | 'primary';
  /**
   * Décalage vertical additionnel au-dessus de la position de base, pour empiler
   * plusieurs FAB sur un même écran (ex. Modifier + Archiver, Bloc 4).
   */
  stackOffset?: number;
}

/**
 * Bouton d'action principal rond et proéminent (mock-up Notre Nid — ex. « Modifier
 * cet item »), à positionner par un parent relatif. Sa position basse tient compte
 * de la zone de sécurité de l'appareil (`useSafeAreaInsets`) plutôt que d'une marge
 * fixe, pour ne jamais se retrouver masqué par la navigation système (Bloc 4).
 * Icône seule : `accessibilityLabel` obligatoire.
 */
export function FloatingActionButton({
  icon,
  onPress,
  accessibilityLabel,
  disabled = false,
  tone = 'secondary',
  stackOffset = 0,
}: FloatingActionButtonProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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
          bottom: insets.bottom + theme.spacing.xl + stackOffset,
          width: FLOATING_ACTION_BUTTON_SIZE,
          height: FLOATING_ACTION_BUTTON_SIZE,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors[tone],
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
