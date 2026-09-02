import type { Category } from '@notre-nid/shared';
import { Pressable, View } from 'react-native';

import { useTheme } from '../theme';

import { AppText } from './AppText';
import { CategoryIllustration } from './CategoryIllustration';

export interface CategoryPickerProps {
  categories: Category[];
  value: string | undefined;
  onChange: (categoryId: string) => void;
}

const CARD_MIN_WIDTH = 76;

/**
 * Sélection visuelle de la catégorie (icône + libellé), préférée à un `Select`
 * générique pour cette étape (docs/NOTRE_NID_PRD.md section 9, référence mockup).
 * Rendu à partir des catégories réellement chargées (système + personnalisées du
 * household) — n'invente jamais une catégorie "Autre" qui n'existe pas côté API.
 */
export function CategoryPicker({ categories, value, onChange }: CategoryPickerProps) {
  const theme = useTheme();

  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
      accessibilityRole="radiogroup"
    >
      {categories.map((category) => {
        const selected = category.id === value;

        return (
          <Pressable
            key={category.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={category.name}
            onPress={() => onChange(category.id)}
            style={({ pressed }) => ({
              minWidth: CARD_MIN_WIDTH,
              minHeight: 44,
              flexGrow: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.xs,
              borderRadius: theme.radii.md,
              borderWidth: selected ? 0 : 1,
              borderColor: theme.colors.border,
              backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            {/* Tuile claire fixe : l'illustration (fond clair, couleurs propres à la
              catégorie) resterait illisible directement sur le fond vert forêt plein
              de la carte sélectionnée — la sélection reste portée par la carte
              (fond, bordure, texte), pas par l'illustration elle-même. */}
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: theme.radii.sm,
                backgroundColor: theme.colors.background,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CategoryIllustration slug={category.slug} size={32} />
            </View>
            <AppText variant="label" color={selected ? 'onPrimary' : 'text'}>
              {category.name}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
