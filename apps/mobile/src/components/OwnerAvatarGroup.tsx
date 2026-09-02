import type { PublicUser } from '@notre-nid/shared';
import { View } from 'react-native';

import { useTheme } from '../theme';

import { AppText } from './AppText';
import { Avatar } from './Avatar';

export interface OwnerAvatarGroupProps {
  owners: PublicUser[];
  max?: number;
}

const AVATAR_SIZE = 28;

/** Avatars des propriétaires : jamais uniquement la position/couleur, toujours un libellé accessible. */
export function OwnerAvatarGroup({ owners, max = 3 }: OwnerAvatarGroupProps) {
  const theme = useTheme();
  const visible = owners.slice(0, max);
  const overflow = owners.length - visible.length;
  const accessibilityLabel = `Propriétaires : ${owners.map((o) => o.displayName).join(', ')}`;

  return (
    <View accessibilityLabel={accessibilityLabel} style={{ flexDirection: 'row' }}>
      {visible.map((owner, index) => (
        <View
          key={owner.id}
          style={{
            borderRadius: theme.radii.full,
            borderWidth: 2,
            borderColor: theme.colors.surface,
            marginLeft: index === 0 ? 0 : -8,
          }}
        >
          <Avatar displayName={owner.displayName} avatarUrl={owner.avatarUrl} size={AVATAR_SIZE} />
        </View>
      ))}
      {overflow > 0 ? (
        <View
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: theme.radii.full,
            backgroundColor: theme.colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: theme.colors.surface,
            marginLeft: -8,
          }}
        >
          <AppText variant="caption" color="text" style={{ fontSize: 11, lineHeight: 13 }}>
            +{overflow}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
