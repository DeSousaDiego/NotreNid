import { View } from 'react-native';

import { CONDITION_INFO } from '../constants/condition';
import { useTheme } from '../theme';
import type { ItemCondition } from '@notre-nid/shared';

import { AppText } from './AppText';

export interface ConditionBadgeProps {
  condition: ItemCondition;
}

/** L'état n'est jamais communiqué uniquement par la couleur : le libellé est toujours affiché. */
export function ConditionBadge({ condition }: ConditionBadgeProps) {
  const theme = useTheme();
  const info = CONDITION_INFO[condition];

  return (
    <View
      accessibilityLabel={`État : ${info.label}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: theme.spacing.xs,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: theme.radii.sm,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors[info.color],
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors[info.color],
        }}
      />
      <AppText variant="caption" color="text">
        {info.label}
      </AppText>
    </View>
  );
}
