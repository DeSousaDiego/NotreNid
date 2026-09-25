import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { ConfirmDialog, ErrorState, LoadingSkeleton, ScreenContainer } from '../../../components';
import { useCategories } from '../../../hooks/useCategories';
import { getErrorMessage } from '../../../lib/errorMessage';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { useAddItemDraft } from '../../../screens/add-item/AddItemDraftContext';
import { useChangeCategoryConfirm } from '../../../screens/add-item/useChangeCategoryConfirm';
import { ItemFormScreen } from '../../../screens/item-form/ItemFormScreen';
import type { ItemFormValues } from '../../../screens/item-form/schema';
import { useTheme } from '../../../theme';

/**
 * Wrapper « création » du flow d'ajout (Bloc 2) : résout la `Category` fixe depuis
 * `categoryId`, fait le pont entre `AddItemDraftContext` et `ItemFormScreen` (qui,
 * lui, ignore tout du Context — seulement `initialValues`/`onValuesChange`, prêt à
 * être réutilisé tel quel par un futur écran de scan).
 */
export default function AddItemFormScreen() {
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

  // Figé au montage — c'est ce qui garantit qu'`ItemFormScreen` ne se réinitialise
  // jamais en cours de frappe (le Context continue d'être mis à jour en tâche de
  // fond via `onValuesChange`, mais cette copie locale n'est plus jamais relue tant
  // que cet écran reste monté). Voir AddItemDraftContext et le commentaire de la
  // prop `initialValues` sur ItemFormScreen.
  const [initialValues] = useState<Partial<ItemFormValues> | undefined>(
    () => draft.draft.values ?? undefined,
  );
  // Même principe de gel au montage — voir `AddItemDraftContext.partialWarning`.
  const [showPartialInfo] = useState<boolean>(() => draft.draft.partialWarning);

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
    <>
      <ItemFormScreen
        mode="create"
        category={category}
        initialValues={initialValues}
        onValuesChange={draft.setValues}
        onChangeCategoryPress={requestChangeCategory}
        infoMessage={
          showPartialInfo
            ? 'Certaines informations n’ont pas pu être trouvées automatiquement. ' +
              'Vérifiez et complétez le formulaire avant l’ajout.'
            : undefined
        }
      />
      <ConfirmDialog
        title="Changer de catégorie ?"
        message="Les informations déjà saisies seront perdues."
        confirmLabel="Changer"
        destructive
        {...confirmDialogProps}
      />
    </>
  );
}
