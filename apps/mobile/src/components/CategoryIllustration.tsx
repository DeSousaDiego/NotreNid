import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { getCategoryIcon, getCategoryIllustration } from '../constants/category-icons';
import { useTheme } from '../theme';

export interface CategoryIllustrationProps {
  slug: string;
  /** Taille carrée en points. */
  size: number;
}

/**
 * Affichage visuel d'une catégorie — illustration officielle pour les 3 catégories
 * système (Livre/CD/DVD), repli sur l'icône générique pour une catégorie
 * personnalisée (aucune illustration dédiée n'existe). Point d'entrée unique pour
 * tout affichage visuel de catégorie hors badge texte compact (Bloc 4) : couverture
 * de repli, CategoryPicker, tuiles de statistiques — voir `CategoryBadge` pour les
 * emplacements trop compacts, qui restent en icône + texte.
 */
export function CategoryIllustration({ slug, size }: CategoryIllustrationProps) {
  const theme = useTheme();
  const illustration = getCategoryIllustration(slug);

  if (illustration) {
    return (
      <Image
        source={illustration}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessible={false}
      />
    );
  }

  return <Ionicons name={getCategoryIcon(slug)} size={size} color={theme.colors.primaryMuted} />;
}
