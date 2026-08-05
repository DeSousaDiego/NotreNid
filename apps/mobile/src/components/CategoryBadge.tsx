import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { getCategoryIcon } from '../constants/category-icons';
import { useTheme } from '../theme';

import { AppText } from './AppText';

export interface CategoryBadgeProps {
  name: string;
  slug: string;
}

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
      <Ionicons name={getCategoryIcon(slug)} size={theme.iconSizes.sm} color={theme.colors.primary} />
      <AppText variant="caption" color="primary">
        {name}
      </AppText>
    </View>
  );
}
