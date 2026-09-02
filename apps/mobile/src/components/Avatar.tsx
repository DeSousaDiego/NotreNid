import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';

import { getInitials } from '../lib/initials';
import { useTheme } from '../theme';

import { AppText } from './AppText';

export interface AvatarProps {
  displayName: string;
  avatarUrl?: string | null;
  /** Diamètre en points. Les usages varient trop selon le contexte (groupe de
   * propriétaires, en-tête de profil…) pour un token de thème unique. */
  size?: number;
}

/** Photo de profil circulaire si `avatarUrl` est valide, sinon repli sur les initiales. */
export function Avatar({ displayName, avatarUrl, size = 40 }: AvatarProps) {
  const theme = useTheme();
  const [loadFailed, setLoadFailed] = useState(false);
  const [lastAvatarUrl, setLastAvatarUrl] = useState(avatarUrl);
  // Repartir d'un état "pas encore essayé" si l'URL change (ex. nouvelle photo après
  // un échec de chargement précédent) — ajustement pendant le rendu plutôt que dans un
  // effet (pattern React recommandé pour réinitialiser un état dérivé d'une prop).
  if (avatarUrl !== lastAvatarUrl) {
    setLastAvatarUrl(avatarUrl);
    setLoadFailed(false);
  }
  const showImage = Boolean(avatarUrl) && !loadFailed;

  return (
    <View
      accessibilityLabel={displayName}
      style={{
        width: size,
        height: size,
        borderRadius: theme.radii.full,
        backgroundColor: theme.colors.primaryMuted,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {showImage ? (
        <Image
          source={{ uri: avatarUrl as string }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={150}
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <AppText
          variant="caption"
          color="onPrimary"
          style={{ fontSize: Math.round(size * 0.4), lineHeight: Math.round(size * 0.46) }}
        >
          {getInitials(displayName)}
        </AppText>
      )}
    </View>
  );
}
