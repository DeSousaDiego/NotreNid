import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';

import { AppText } from './AppText';

/** `dangerOutline` : action destructive secondaire (contour + texte `danger`, jamais un aplat) —
 * pour une action qu'on veut identifiable comme destructive sans la rendre dominante. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerOutline';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
}

/** Zone tactile ≥ 44×44, états default/pressed/disabled/loading (docs/NOTRE_NID_PRD.md section 4.6). */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  accessibilityHint,
}: ButtonProps) {
  const theme = useTheme();
  const isInteractive = !disabled && !loading;

  const isOutline = variant === 'ghost' || variant === 'dangerOutline';

  const backgroundFor = (pressed: boolean): string => {
    if (variant === 'dangerOutline')
      return pressed ? withOpacity(theme.colors.danger, 0.08) : 'transparent';
    if (variant === 'ghost') return 'transparent';
    const base =
      variant === 'primary'
        ? theme.colors.primary
        : variant === 'danger'
          ? theme.colors.danger
          : theme.colors.secondary;
    return pressed ? withOpacity(base, 0.85) : base;
  };

  const textColor =
    variant === 'ghost'
      ? theme.colors.primary
      : variant === 'dangerOutline'
        ? theme.colors.danger
        : theme.colors.onPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      accessibilityHint={accessibilityHint}
      disabled={!isInteractive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: 44,
          borderRadius: theme.radii.md,
          paddingHorizontal: theme.spacing.lg,
          backgroundColor: backgroundFor(pressed),
          borderWidth: isOutline ? 1 : 0,
          borderColor:
            variant === 'dangerOutline'
              ? withOpacity(theme.colors.danger, 0.45)
              : theme.colors.border,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        // `flexShrink` + centrage : un libellé long passe à la ligne à l'intérieur du
        // bouton quand celui-ci est contraint en largeur, au lieu de déborder.
        <AppText variant="label" style={{ color: textColor, textAlign: 'center', flexShrink: 1 }}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

function withOpacity(hexColor: string, opacity: number): string {
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hexColor}${alpha}`;
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
