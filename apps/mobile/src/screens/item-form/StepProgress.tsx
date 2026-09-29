import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { AppText } from '../../components';
import { useTheme } from '../../theme';

export interface StepProgressProps {
  steps: readonly string[];
  /** Index (0-based) de l'étape courante. */
  current: number;
}

const MARKER_SIZE = 28;

/**
 * Trois petits repères reliés par un trait : terminé (vert forêt + coche), en
 * cours (terracotta), à venir (contour). Lu comme un seul titre par les lecteurs
 * d'écran : « Étape 2 sur 3, Votre exemplaire ».
 */
export function StepProgress({ steps, current }: StepProgressProps) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={`Étape ${current + 1} sur ${steps.length}, ${steps[current]}`}
      testID="step-progress"
      style={{ flexDirection: 'row', alignItems: 'flex-start' }}
    >
      {steps.map((label, index) => {
        const status = index < current ? 'done' : index === current ? 'current' : 'upcoming';
        const markerColor =
          status === 'done'
            ? theme.colors.primary
            : status === 'current'
              ? theme.colors.secondary
              : theme.colors.surface;

        return (
          <View key={label} style={{ flex: 1, alignItems: 'center', gap: theme.spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
              <Connector visible={index > 0} active={index <= current} />
              <View
                testID={`step-marker-${index}`}
                style={{
                  width: MARKER_SIZE,
                  height: MARKER_SIZE,
                  borderRadius: theme.radii.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: markerColor,
                  borderWidth: status === 'upcoming' ? 1.5 : 0,
                  borderColor: theme.colors.primaryMuted,
                }}
              >
                {status === 'done' ? (
                  <Ionicons
                    name="checkmark"
                    size={theme.iconSizes.sm}
                    color={theme.colors.onPrimary}
                  />
                ) : (
                  <AppText variant="label" color={status === 'current' ? 'onPrimary' : 'textMuted'}>
                    {index + 1}
                  </AppText>
                )}
              </View>
              <Connector visible={index < steps.length - 1} active={index < current} />
            </View>
            <AppText
              variant="caption"
              color={status === 'current' ? 'text' : 'textMuted'}
              numberOfLines={2}
              style={{
                textAlign: 'center',
                fontFamily: status === 'current' ? theme.fonts.semiBold : theme.fonts.regular,
              }}
            >
              {label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

/** Demi-trait de part et d'autre d'un repère (invisible aux extrémités). */
function Connector({ visible, active }: { visible: boolean; active: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        height: 2,
        borderRadius: theme.radii.full,
        backgroundColor: visible
          ? active
            ? theme.colors.primary
            : theme.colors.border
          : 'transparent',
      }}
    />
  );
}
