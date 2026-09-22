import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { AppText, ScreenContainer } from '../../../components';
import { useTheme } from '../../../theme';

function withOpacity(hexColor: string, opacity: number): string {
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hexColor}${alpha}`;
}

/**
 * Onglet « Statistiques » (anciennement « Recherche ») — pour l'instant un
 * état "à venir" volontairement vide fonctionnellement : le contenu réel
 * (nouvelles façons de parcourir/comprendre la collection) n'est pas encore
 * spécifié, cet écran ne doit donc jamais laisser deviner une fonctionnalité
 * précise. `SearchField`/recherche globale n'existent plus comme onglet dédié
 * — la recherche reste disponible depuis Collection (voir `collection/index.tsx`).
 */
export default function StatsScreen() {
  const theme = useTheme();

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.lg,
        }}
      >
        <Ionicons name="sparkles-outline" size={64} color={theme.colors.accent} />

        <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          <AppText variant="title" style={{ textAlign: 'center' }}>
            Statistiques
          </AppText>
          <View
            style={{
              backgroundColor: withOpacity(theme.colors.accent, 0.18),
              borderWidth: 1,
              borderColor: theme.colors.accent,
              borderRadius: theme.radii.full,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: 4,
            }}
          >
            <AppText variant="label" color="text">
              À venir
            </AppText>
          </View>
        </View>

        <View style={{ alignItems: 'center', gap: theme.spacing.sm, maxWidth: 320 }}>
          <AppText variant="section" style={{ textAlign: 'center' }}>
            Cette section est encore en préparation.
          </AppText>
          <AppText variant="body" color="textMuted" style={{ textAlign: 'center' }}>
            Bientôt, vous pourrez y découvrir votre collection sous un nouvel angle, avec de
            nouvelles façons de la parcourir et de mieux la comprendre.
          </AppText>
        </View>

        <AppText variant="caption" color="textMuted" style={{ textAlign: 'center', maxWidth: 280 }}>
          Encore un peu de patience, cette partie de Notre Nid arrivera prochainement.
        </AppText>
      </View>
    </ScreenContainer>
  );
}
