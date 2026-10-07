import { ScrollView, View } from 'react-native';

import {
  AppText,
  CategoryIllustration,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  RowGroup,
  ScreenContainer,
} from '../../../components';
import { getCategoryTint } from '../../../constants/category-icons';
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
  // `data` d'abord : un refetch en échec garde la dernière liste valide (TanStack Query v5).
  const categories = categoriesQuery.data;

  if (!categories && categoriesQuery.isLoading) {
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']}>
        <LoadingSkeleton height={220} />
      </ScreenContainer>
    );
  }

  if (!categories) {
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']}>
        {categoriesQuery.isError ? (
          <ErrorState
            message={getErrorMessage(categoriesQuery.error)}
            onRetry={() => void categoriesQuery.refetch()}
          />
        ) : null}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      {categories.length === 0 ? (
        <EmptyState icon="pricetag-outline" title="Aucune catégorie" />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
        >
          <AppText variant="body" color="textMuted">
            Les familles d’objets de votre nid.
          </AppText>
          <RowGroup>
            {categories.map((category) => (
              <View
                key={category.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  minHeight: 64,
                  paddingVertical: theme.spacing.sm,
                }}
              >
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: theme.radii.full,
                    backgroundColor: theme.colors[getCategoryTint(category.slug)],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CategoryIllustration slug={category.slug} size={28} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="body">{category.name}</AppText>
                  <AppText variant="caption" color="textMuted">
                    {category.isSystem ? 'Catégorie système' : 'Catégorie personnalisée'}
                  </AppText>
                </View>
              </View>
            ))}
          </RowGroup>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
