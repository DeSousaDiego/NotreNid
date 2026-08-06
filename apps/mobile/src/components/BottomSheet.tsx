import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/**
 * Panneau modal glissant depuis le bas (ex. filtres). Fermeture par le
 * bouton de fermeture ou en touchant l'arrière-plan — pas de geste de
 * balayage pour l'instant (évite une dépendance gesture-handler/reanimated
 * supplémentaire pour la Phase 3A).
 */
export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Fermer le panneau" style={styles.backdrop} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={styles.sheetWrapper}>
        <View
          style={[
            styles.sheet,
            {
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
          {children}
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
  sheet: {
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
