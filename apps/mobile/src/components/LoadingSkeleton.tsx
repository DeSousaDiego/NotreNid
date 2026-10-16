import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, View, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';

export interface LoadingSkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/** Bloc de chargement pulsant. Respecte la réduction des animations système. */
export function LoadingSkeleton({
  width = '100%',
  height = 16,
  radius,
  style,
}: LoadingSkeletonProps) {
  const theme = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) return;
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        ]),
      );
      animation.start();
    });

    return () => animation?.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radii.sm,
          backgroundColor: theme.colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

/**
 * Squelette d'une carte de collection (voir ItemCard) : même surface, même
 * miniature portrait 48×64, et les trois lignes réelles (titre, créateur · année,
 * propriétaires) — pas de forme par avatar, juste les bonnes proportions.
 */
export function ItemCardSkeleton() {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radii.lg,
        backgroundColor: theme.colors.surface,
      }}
    >
      <LoadingSkeleton width={48} height={64} radius={theme.radii.sm} />
      <View style={{ flex: 1, gap: 6 }}>
        <LoadingSkeleton width="70%" height={18} />
        <LoadingSkeleton width="45%" height={12} />
        <LoadingSkeleton width="35%" height={16} radius={theme.radii.full} />
      </View>
    </View>
  );
}
