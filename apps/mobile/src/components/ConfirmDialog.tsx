import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

import { AppText } from './AppText';
import { Button } from './Button';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style « danger » pour les actions destructrices (archivage, suppression). */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation modale centrée — actions destructrices/administratives (docs/NOTRE_NID_PRD.md section 4.6). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const theme = useTheme();
  // Comme BottomSheet : une hauteur en % résolue contre un parent absolument
  // positionné est indéterminée, d'où useWindowDimensions plutôt qu'un pourcentage.
  const { height: windowHeight } = useWindowDimensions();
  const maxDialogHeight = windowHeight * 0.8;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        accessibilityLabel="Fermer"
        style={styles.backdrop}
        onPress={loading ? undefined : onCancel}
      />
      <SafeAreaView style={styles.centerer} pointerEvents="box-none">
        <View
          style={[
            styles.dialog,
            {
              maxHeight: maxDialogHeight,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radii.lg,
              padding: theme.spacing.lg,
            },
            theme.elevation.medium,
          ]}
        >
          <ScrollView style={styles.scrollArea} contentContainerStyle={{ gap: theme.spacing.md }}>
            <AppText variant="section">{title}</AppText>
            {message ? <AppText variant="body">{message}</AppText> : null}
          </ScrollView>
          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing.sm,
              justifyContent: 'flex-end',
              marginTop: theme.spacing.md,
            }}
          >
            <Button label={cancelLabel} variant="ghost" onPress={onCancel} disabled={loading} />
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={loading}
            />
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
  centerer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
  },
  // flexShrink permet au ScrollView de céder de la place aux boutons plutôt que de
  // déborder silencieusement au-delà de maxHeight (même piège que BottomSheet).
  scrollArea: {
    flexShrink: 1,
  },
});
