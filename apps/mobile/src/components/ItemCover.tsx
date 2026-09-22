import { Image } from 'expo-image';
import { useState } from 'react';
import { View, type ViewStyle } from 'react-native';

import { CategoryIllustration } from './CategoryIllustration';

export interface ItemCoverProps {
  /** `item.coverImageUrl` (ou l'équivalent brouillon, ex. `previewUri` du picker) — `null`/`undefined`/`''` sont tous traités comme « pas de couverture ». */
  uri: string | null | undefined;
  categorySlug: string;
  /** Taille du repli `CategoryIllustration`, jamais celle du conteneur (voir `style`). */
  illustrationSize: number;
  /** Dimensions/rayon/fond propres à chaque emplacement (carte, ligne, détail…) — ce
   * composant ne fixe volontairement aucune taille, pour rester utilisable partout
   * sans jamais dicter de design. */
  style?: ViewStyle;
  /** Durée du fondu d'apparition (ms) — `0` par défaut (pas de fondu), à aligner
   * explicitement sur le comportement déjà en place à chaque appel plutôt que
   * d'en changer un silencieusement lors de ce refactor. */
  transition?: number;
}

/**
 * Couverture d'item, avec repli robuste sur l'illustration de catégorie — même
 * principe que `Avatar.tsx` (état local `loadFailed`, `onError`, réinitialisé
 * pendant le rendu si `uri` change) : une URL absente ET une URL présente mais
 * dont le chargement échoue (lien externe mort, hébergement expiré — nombre de
 * couvertures issues d'un scan restent hotlinkées chez le fournisseur, jamais
 * réimportées, voir docs/DECISIONS.md) aboutissent toutes deux au même repli,
 * jamais à un cadre vide.
 */
export function ItemCover({
  uri,
  categorySlug,
  illustrationSize,
  style,
  transition = 0,
}: ItemCoverProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const [lastUri, setLastUri] = useState(uri);
  if (uri !== lastUri) {
    setLastUri(uri);
    setLoadFailed(false);
  }
  const showImage = Boolean(uri) && !loadFailed;

  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      {showImage ? (
        <Image
          source={{ uri: uri as string }}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
          transition={transition}
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <CategoryIllustration slug={categorySlug} size={illustrationSize} />
      )}
    </View>
  );
}
