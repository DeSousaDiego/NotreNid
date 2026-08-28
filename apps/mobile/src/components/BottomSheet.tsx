import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /**
   * Passer à `false` quand `children` gère déjà son propre défilement (ex. une `FlatList`,
   * voir `Select`) : imbriquer une liste virtualisée dans le `ScrollView` par défaut casse
   * son défilement (et déclenche l'avertissement React Native correspondant). Par défaut à
   * `true` pour un contenu classique (Views/Chips) qui doit pouvoir défiler si son contenu
   * dépasse la hauteur disponible.
   */
  scrollable?: boolean;
}

/**
 * Panneau modal glissant depuis le bas (ex. filtres). Fermeture par le
 * bouton de fermeture ou en touchant l'arrière-plan — pas de geste de
 * balayage pour l'instant (évite une dépendance gesture-handler/reanimated
 * supplémentaire pour la Phase 3A).
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  scrollable = true,
}: BottomSheetProps) {
  const theme = useTheme();
  // `maxHeight: '80%'` en pourcentage ne fonctionnait pas de façon fiable : le conteneur
  // parent (positionné en absolute, sans `top`) n'a pas de hauteur déterminée à partir de
  // laquelle calculer ce pourcentage. Un maximum en pixels, dérivé de la hauteur réelle de
  // la fenêtre, borne le panneau de façon fiable quel que soit l'écran.
  const { height: windowHeight } = useWindowDimensions();
  const maxSheetHeight = windowHeight * 0.8;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Fermer le panneau" style={styles.backdrop} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={styles.sheetWrapper}>
        <View
          style={[
            styles.sheet,
            {
              maxHeight: maxSheetHeight,
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radii.xl,
              borderTopRightRadius: theme.radii.xl,
              padding: theme.spacing.lg,
            },
            theme.elevation.medium,
          ]}
        >
          {title ? (
            <View style={[styles.header, { marginBottom: theme.spacing.md }]}>
              <AppText variant="section">{title}</AppText>
              <IconButton name="close" accessibilityLabel="Fermer" onPress={onClose} />
            </View>
          ) : null}
          <View style={styles.body}>
            {scrollable ? (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollArea}>
                {children}
              </ScrollView>
            ) : (
              children
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(38, 49, 42, 0.4)',
  },
  sheetWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // `flexShrink: 1` sur le conteneur et sur le ScrollView lui-même : sans ça, un enfant
  // sans hauteur explicite se dimensionne à son contenu naturel et dépasse silencieusement
  // le `maxHeight` du panneau plutôt que de se contraindre et défiler.
  body: {
    flexShrink: 1,
  },
  scrollArea: {
    flexShrink: 1,
  },
});
