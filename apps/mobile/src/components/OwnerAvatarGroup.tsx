import type { PublicUser } from '@notre-nid/shared';
import { View } from 'react-native';

import { useTheme, type ColorToken } from '../theme';

import { AppText } from './AppText';
import { Avatar } from './Avatar';

export interface OwnerAvatarGroupProps {
  owners: PublicUser[];
  max?: number;
  /** Diamètre de chaque avatar (28 par défaut, cartes d'objets). */
  size?: number;
  /** Couleur du liseré qui sépare les avatars superposés — celle du fond porteur. */
  ringColor?: ColorToken;
  /** Libellé accessible du groupe (« Propriétaires : … » par défaut). */
  accessibilityLabel?: string;
}

const DEFAULT_AVATAR_SIZE = 28;

/** Avatars des propriétaires : jamais uniquement la position/couleur, toujours un libellé accessible. */
export function OwnerAvatarGroup({
  owners,
  max = 3,
  size = DEFAULT_AVATAR_SIZE,
  ringColor = 'surface',
  accessibilityLabel,
}: OwnerAvatarGroupProps) {
  const theme = useTheme();
  const visible = owners.slice(0, max);
  const overflow = owners.length - visible.length;
  const label =
    accessibilityLabel ?? `Propriétaires : ${owners.map((o) => o.displayName).join(', ')}`;
  const overlap = -Math.round(size * 0.28);

  return (
    <View accessibilityLabel={label} style={{ flexDirection: 'row' }}>
      {visible.map((owner, index) => (
        <View
          key={owner.id}
          style={{
            borderRadius: theme.radii.full,
            borderWidth: 2,
            borderColor: theme.colors[ringColor],
            marginLeft: index === 0 ? 0 : overlap,
          }}
        >
          <Avatar displayName={owner.displayName} avatarUrl={owner.avatarUrl} size={size} />
        </View>
      ))}
      {overflow > 0 ? (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: theme.radii.full,
            backgroundColor: theme.colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: theme.colors[ringColor],
            marginLeft: overlap,
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
