import { Pressable } from 'react-native';

import { useTheme } from '../theme';

import { AppText } from './AppText';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/** Hauteur visible de la chip ; `CHIP_HIT_SLOP` complète la zone tactile à 44 pt
 * sans grossir l'écran (prévoir au moins `2 × CHIP_HIT_SLOP` entre deux rangées
 * pour que les zones tactiles ne se chevauchent pas). */
const CHIP_HEIGHT = 36;
export const CHIP_HIT_SLOP = (44 - CHIP_HEIGHT) / 2;

/** Étiquette sélectionnable (filtres, catégories). */
export function Chip({
  label,
  selected = false,
  onPress,
  disabled = false,
  accessibilityLabel,
}: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={{ top: CHIP_HIT_SLOP, bottom: CHIP_HIT_SLOP }}
      style={({ pressed }) => ({
        minHeight: CHIP_HEIGHT,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radii.full,
        borderWidth: 1,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        backgroundColor: selected
          ? theme.colors.primary
          : pressed
            ? theme.colors.border
            : theme.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <AppText variant="label" color={selected ? 'onPrimary' : 'text'}>
        {label}
      </AppText>
    </Pressable>
  );
}
