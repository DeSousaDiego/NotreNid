import { SYSTEM_CATEGORY_SLUGS } from '@notre-nid/shared';
import { View } from 'react-native';

import { useTheme } from '../theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { CategoryIllustration } from './CategoryIllustration';

const NEST_CATEGORY_SLUGS = [
  SYSTEM_CATEGORY_SLUGS.BOOK,
  SYSTEM_CATEGORY_SLUGS.CD,
  SYSTEM_CATEGORY_SLUGS.DVD,
] as const;

/** État vide du foyer — surface pêche, trois pastilles Livre/CD/DVD, CTA d'ajout.
 * Partagé par l'Accueil et la Collection (bibliothèque réellement vide). */
export function EmptyNest({ onAdd }: { onAdd: () => void }) {
  const theme = useTheme();
  const decorativeCircle = {
    position: 'absolute',
    borderRadius: theme.radii.full,
    opacity: 0.7,
  } as const;

  return (
    <View
      style={{
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.xl,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radii.xl,
        backgroundColor: theme.colors.tintPeach,
        overflow: 'hidden',
      }}
    >
      <View
        style={[
          decorativeCircle,
          { top: -36, left: -36, width: 110, height: 110, backgroundColor: theme.colors.tintHoney },
        ]}
      />
      <View
        style={[
          decorativeCircle,
          {
            bottom: -28,
            right: -28,
            width: 90,
            height: 90,
            backgroundColor: theme.colors.tintSage,
          },
        ]}
      />

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row' }}
      >
        {NEST_CATEGORY_SLUGS.map((slug, index) => (
          <View
            key={slug}
            style={{
              width: 56,
              height: 56,
              marginLeft: index === 0 ? 0 : -theme.spacing.md,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radii.full,
              borderWidth: 3,
              borderColor: theme.colors.tintPeach,
              backgroundColor: theme.colors.surface,
            }}
          >
            <CategoryIllustration slug={slug} size={32} />
          </View>
        ))}
      </View>

      <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
        <AppText variant="section" accessibilityRole="header" style={{ textAlign: 'center' }}>
          Votre nid est encore vide.
        </AppText>
        <AppText variant="body" style={{ textAlign: 'center' }}>
          Ajoutez votre premier trésor.
        </AppText>
      </View>

      <Button
        label="Ajouter un objet"
        variant="secondary"
        onPress={onAdd}
        style={{ alignSelf: 'stretch' }}
      />
    </View>
  );
}
