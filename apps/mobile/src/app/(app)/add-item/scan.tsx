import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { AppText, Button, ScreenContainer } from '../../../components';
import { useTheme } from '../../../theme';

/**
 * Placeholder du scanner (Bloc 2) — le vrai scan caméra arrive au Bloc 3. Reste
 * volontairement minimal : pas de fausse UI caméra à maintenir/jeter ensuite.
 */
export default function AddItemScanScreen() {
  const theme = useTheme();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg }}
      >
        <Ionicons name="barcode-outline" size={64} color={theme.colors.primaryMuted} />
        <View style={{ gap: theme.spacing.xs, alignItems: 'center' }}>
          <AppText variant="section" style={{ textAlign: 'center' }}>
            Le scanner arrive bientôt
          </AppText>
          <AppText variant="body" color="textMuted" style={{ textAlign: 'center' }}>
            Cette fonctionnalité sera disponible dans une prochaine mise à jour.
          </AppText>
        </View>
        <Button
          label="Saisir manuellement à la place"
          onPress={() =>
            router.replace({ pathname: '/(app)/add-item/form', params: { categoryId } })
          }
        />
      </View>
    </ScreenContainer>
  );
}
