import { View } from 'react-native';

import { useTheme } from '../theme';

import { AppText } from './AppText';
import { CategoryIllustration } from './CategoryIllustration';

export interface CategoryBadgeProps {
  name: string;
  slug: string;
}

// Fond du badge déjà clair (`theme.colors.background`) : contrairement à
// CategoryPicker (carte sélectionnée en vert forêt plein), l'illustration n'a pas
// besoin d'une tuile claire dédiée pour rester lisible ici.
const ILLUSTRATION_SIZE = 18;

export function CategoryBadge({ name, slug }: CategoryBadgeProps) {
  const theme = useTheme();

  return (
    <View
      accessibilityLabel={`Catégorie : ${name}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: theme.spacing.xs,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: theme.radii.sm,
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <CategoryIllustration slug={slug} size={ILLUSTRATION_SIZE} />
      <AppText variant="caption" color="primary">
        {name}
      </AppText>
    </View>
  );
}
