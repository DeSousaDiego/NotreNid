import { FlatList, View } from 'react-native';

import {
  AppText,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  ScreenContainer,
} from '../../../components';
import { useCategories } from '../../../hooks/useCategories';
import { getErrorMessage } from '../../../lib/errorMessage';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { useTheme } from '../../../theme';

/**
 * V1 se limite aux 3 catégories système (Livre/CD/DVD) : cet écran est en lecture
 * seule (Bloc 4). Le backend garde la gestion complète des catégories personnalisées
 * (création/édition/suppression, guards OWNER/ADMIN) pour rester future-proof si
 * elles reviennent dans une prochaine version — seule l'UI mobile est simplifiée.
 */
export default function CategoriesScreen() {
  const theme = useTheme();
  const { householdId } = useHousehold();
  const categoriesQuery = useCategories(householdId);

  if (categoriesQuery.isLoading) {
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']}>
        <LoadingSkeleton height={220} />
      </ScreenContainer>
    );
  }

  if (categoriesQuery.isError) {
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']}>
        <ErrorState
          message={getErrorMessage(categoriesQuery.error)}
          onRetry={() => void categoriesQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  const categories = categoriesQuery.data ?? [];

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      {categories.length === 0 ? (
        <EmptyState icon="pricetag-outline" title="Aucune catégorie" />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(category) => category.id}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xs }}
          renderItem={({ item: category }) => (
            <View
              style={{
                paddingVertical: theme.spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <AppText variant="body">{category.name}</AppText>
              <AppText variant="caption" color="textMuted">
                {category.isSystem ? 'Catégorie système' : 'Catégorie personnalisée'}
              </AppText>
            </View>
          )}
        />
      )}
    </ScreenContainer>
  );
}
