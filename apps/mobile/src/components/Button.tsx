import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';

import { AppText } from './AppText';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

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

  const backgroundFor = (pressed: boolean): string => {
    if (variant === 'ghost') return 'transparent';
    const base = variant === 'primary' ? theme.colors.primary : theme.colors.secondary;
    return pressed ? withOpacity(base, 0.85) : base;
  };

  const textColor = variant === 'ghost' ? theme.colors.primary : theme.colors.onPrimary;

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
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: theme.colors.border,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <AppText variant="label" style={{ color: textColor }}>
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
