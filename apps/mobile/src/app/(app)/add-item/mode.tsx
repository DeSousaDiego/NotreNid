import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import {
  AppText,
  CategoryIllustration,
  ConfirmDialog,
  ErrorState,
  LoadingSkeleton,
  ScreenContainer,
} from '../../../components';
import { useCategories } from '../../../hooks/useCategories';
import { getErrorMessage } from '../../../lib/errorMessage';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { useAddItemDraft } from '../../../screens/add-item/AddItemDraftContext';
import { SelectionCard } from '../../../screens/add-item/SelectionCard';
import { useChangeCategoryConfirm } from '../../../screens/add-item/useChangeCategoryConfirm';
import { categoryAddTitle } from '../../../screens/item-form/metadataFields';
import { useTheme } from '../../../theme';

/** Écran « Choisir le mode d'ajout » — Scanner (placeholder) ou Saisie manuelle (Bloc 2). */
export default function AddItemModeScreen() {
  const theme = useTheme();
  const { householdId } = useHousehold();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const categoriesQuery = useCategories(householdId);
  const draft = useAddItemDraft();
  const { requestChangeCategory, confirmDialogProps } = useChangeCategoryConfirm();

  const category = categoriesQuery.data?.find((c) => c.id === categoryId);

  useEffect(() => {
    if (categoryId) draft.setCategory(categoryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `draft.setCategory` est mémoïsé (identité stable) ; ne doit courir qu'au changement de `categoryId`.
  }, [categoryId]);

  if (categoriesQuery.isLoading) {
    return (
      <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
        <LoadingSkeleton height={220} radius={theme.radii.lg} />
      </ScreenContainer>
    );
  }

  if (categoriesQuery.isError) {
    return (
      <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
        <ErrorState
          title="Catégories indisponibles"
          message={getErrorMessage(categoriesQuery.error)}
          onRetry={() => void categoriesQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  if (!category) {
    return (
      <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
        <ErrorState
          title="Catégorie introuvable"
          message="Revenez à l'écran précédent et choisissez une catégorie."
          onRetry={() => router.dismissTo('/(app)/add-item/category')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="title">{categoryAddTitle(category)}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <CategoryIllustration slug={category.slug} size={24} />
          <AppText variant="label" color="textMuted">
            {category.name}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Changer de catégorie"
            onPress={requestChangeCategory}
            hitSlop={8}
          >
            <AppText variant="label" color="secondary">
              Changer
            </AppText>
          </Pressable>
        </View>
      </View>

      <AppText variant="body" color="textMuted" style={{ marginTop: theme.spacing.lg }}>
        Comment souhaitez-vous l’ajouter ?
      </AppText>

      <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.md }}>
        <SelectionCard
          title="Scanner un code-barres"
          subtitle="Rechercher automatiquement les informations"
          icon={<Ionicons name="barcode-outline" size={36} color={theme.colors.primary} />}
          onPress={() =>
            router.push({ pathname: '/(app)/add-item/scan', params: { categoryId: category.id } })
          }
        />
        <SelectionCard
          title="Saisir manuellement"
          subtitle="Remplir les informations vous-même"
          icon={<Ionicons name="create-outline" size={36} color={theme.colors.primary} />}
          onPress={() =>
            router.push({ pathname: '/(app)/add-item/form', params: { categoryId: category.id } })
          }
        />
      </View>

      <ConfirmDialog
        title="Changer de catégorie ?"
        message="Les informations déjà saisies seront perdues."
        confirmLabel="Changer"
        destructive
        {...confirmDialogProps}
      />
    </ScreenContainer>
  );
}
