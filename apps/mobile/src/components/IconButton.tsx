import { Ionicons } from '@expo/vector-icons';
import { Pressable, type PressableProps } from 'react-native';

import type { ColorToken, IconSizeToken } from '../theme';
import { useTheme } from '../theme';

export interface IconButtonProps {
  name: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  color?: ColorToken;
  size?: IconSizeToken;
  disabled?: boolean;
  accessibilityLabel: string;
}

/** Bouton icône seul : zone tactile 44×44 garantie même si l'icône est plus petite. */
export function IconButton({
  name,
  onPress,
  color = 'text',
  size = 'md',
  disabled = false,
  accessibilityLabel,
}: IconButtonProps) {
  const theme = useTheme();

  const style: PressableProps['style'] = ({ pressed }) => ({
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.full,
    opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={style}
      hitSlop={8}
    >
      <Ionicons name={name} size={theme.iconSizes[size]} color={theme.colors[color]} />
    </Pressable>
  );
}
