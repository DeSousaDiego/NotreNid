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

/** Squelette d'une carte de collection (voir ItemCard). */
export function ItemCardSkeleton() {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <LoadingSkeleton width={56} height={56} radius={theme.radii.sm} />
      <View style={{ flex: 1, gap: theme.spacing.xs, justifyContent: 'center' }}>
        <LoadingSkeleton width="70%" height={16} />
        <LoadingSkeleton width="40%" height={12} />
        <LoadingSkeleton width="50%" height={20} />
      </View>
    </View>
  );
}
