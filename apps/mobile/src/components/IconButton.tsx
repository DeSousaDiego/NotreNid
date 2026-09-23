import { Ionicons } from '@expo/vector-icons';
import { Pressable, View, type PressableProps } from 'react-native';

import type { ColorToken, IconSizeToken } from '../theme';
import { useTheme } from '../theme';

import { AppText } from './AppText';

export interface IconButtonProps {
  name: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  color?: ColorToken;
  size?: IconSizeToken;
  disabled?: boolean;
  accessibilityLabel: string;
  /**
   * Petit badge numérique superposé (ex. nombre de filtres actifs) — masqué si
   * absent ou ≤ 0. Plafonné à l'affichage `9+` au-delà de 9, sans jamais tronquer
   * silencieusement une valeur plus précise dans `accessibilityLabel` (à la charge
   * de l'appelant, qui connaît le nombre réel).
   */
  badgeCount?: number;
}

/** Bouton icône seul : zone tactile 44×44 garantie même si l'icône est plus petite. */
export function IconButton({
  name,
  onPress,
  color = 'text',
  size = 'md',
  disabled = false,
  accessibilityLabel,
  badgeCount,
}: IconButtonProps) {
  const theme = useTheme();
  const badgeLabel =
    typeof badgeCount === 'number' && badgeCount > 0
      ? badgeCount > 9
        ? '9+'
        : String(badgeCount)
      : null;

  const style: PressableProps['style'] = ({ pressed }) => ({
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.full,
    opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
  });

  return (
    <View style={{ alignSelf: 'flex-start' }}>
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
      {badgeLabel ? (
        // `pointerEvents="none"` : purement décoratif, ne doit jamais réduire ni
        // déplacer la zone tactile 44×44 du `Pressable` qu'il chevauche.
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: theme.radii.full,
            backgroundColor: theme.colors.secondary,
            borderWidth: 1.5,
            borderColor: theme.colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText
            variant="caption"
            color="onPrimary"
            style={{ fontSize: 11, lineHeight: 13 }}
            allowFontScaling={false}
          >
            {badgeLabel}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
