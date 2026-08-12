import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

import {
  AppText,
  Button,
  ErrorState,
  LoadingSkeleton,
  ScreenContainer,
  useToast,
} from '../../components';
import { useCategories } from '../../hooks/useCategories';
import { useCreateItem, useUpdateItem } from '../../hooks/useItemMutations';
import { useItem } from '../../hooks/useItem';
import { useMembers } from '../../hooks/useMembers';
import { getErrorMessage } from '../../lib/errorMessage';
import { useHousehold } from '../../providers/HouseholdProvider';
import { useTheme } from '../../theme';

import { StepBasics } from './StepBasics';
import { StepMetadata } from './StepMetadata';
import { StepReview } from './StepReview';
import {
  buildItemPayload,
  EMPTY_ITEM_FORM_VALUES,
  findMissingRequiredCustomFields,
  itemFormSchema,
  itemToFormValues,
  type ItemFormValues,
} from './schema';

export interface ItemFormScreenProps {
  mode: 'create' | 'edit';
  itemId?: string;
}

const STEP_TITLES = ['Informations', 'Détails', 'Propriétaires et couverture'];

export function ItemFormScreen({ mode, itemId }: ItemFormScreenProps) {
  const theme = useTheme();
  const { showToast } = useToast();
  const { householdId } = useHousehold();
  const categoriesQuery = useCategories(householdId);
  const membersQuery = useMembers(householdId);
  const itemQuery = useItem(mode === 'edit' ? householdId : null, itemId ?? '');
  const createItem = useCreateItem(householdId);
  const updateItem = useUpdateItem(householdId);

  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultValues = useMemo(
    () =>
      mode === 'edit' && itemQuery.data ? itemToFormValues(itemQuery.data) : EMPTY_ITEM_FORM_VALUES,
    [mode, itemQuery.data],
  );

  const {
    control,
    handleSubmit,
    trigger,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues,
    values: mode === 'edit' && itemQuery.data ? defaultValues : undefined,
  });

  // `useWatch` without a `name` types every field as optional (it can genuinely
  // be partial while async default values are still loading in edit mode) —
  // merge with empty defaults so the rest of this screen can rely on the full
  // `ItemFormValues` shape.
  const watched = useWatch<ItemFormValues>({ control });
  const values: ItemFormValues = {
    ...EMPTY_ITEM_FORM_VALUES,
    ...watched,
    metadata: { ...EMPTY_ITEM_FORM_VALUES.metadata, ...watched.metadata },
    customMetadata: {
      ...EMPTY_ITEM_FORM_VALUES.customMetadata,
      ...watched.customMetadata,
    } as Record<string, string>,
  };
  const categories = categoriesQuery.data ?? [];
  const selectedCategory = categories.find((category) => category.id === values.categoryId);

  if (mode === 'edit' && itemQuery.isLoading) {
    return (
      <ScreenContainer>
        <LoadingSkeleton height={220} radius={theme.radii.lg} />
      </ScreenContainer>
    );
  }

  if (mode === 'edit' && (itemQuery.isError || !itemQuery.data)) {
    return (
      <ScreenContainer>
        <ErrorState
          title="Objet introuvable"
          message={itemQuery.error ? getErrorMessage(itemQuery.error) : "Cet objet n'existe pas."}
          onRetry={() => void itemQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  const goNext = async () => {
    clearErrors();
    if (step === 0) {
      const valid = await trigger(['categoryId', 'title', 'condition']);
      if (!valid) return;
    }
    if (step === 1 && selectedCategory) {
      const missing = findMissingRequiredCustomFields(selectedCategory, values.customMetadata);
      if (missing.length > 0) {
        setSubmitError(`Champs requis manquants : ${missing.join(', ')}.`);
        return;
      }
    }
    setSubmitError(null);
    setStep((current) => Math.min(current + 1, STEP_TITLES.length - 1));
  };

  const goBack = () => {
    setSubmitError(null);
    setStep((current) => Math.max(current - 1, 0));
  };

  const onSubmit = handleSubmit(async (formValues) => {
    if (!selectedCategory) {
      setError('categoryId', { message: 'Choisissez une catégorie.' });
      return;
    }
    setSubmitError(null);

    try {
      const payload = buildItemPayload(formValues, selectedCategory);
      if (mode === 'create') {
        await createItem.mutateAsync(payload);
        showToast('Cet objet a rejoint votre nid.', 'success');
        router.replace('/(app)/collection');
      } else if (itemId) {
        await updateItem.mutateAsync({ itemId, input: payload });
        showToast('Objet modifié.', 'success');
        router.back();
      }
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  });

  const isLastStep = step === STEP_TITLES.length - 1;
  const isBusy = isSubmitting || createItem.isPending || updateItem.isPending;

  return (
    <ScreenContainer scroll>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="title">
            {mode === 'create' ? 'Ajouter un objet' : "Modifier l'objet"}
          </AppText>
          <AppText variant="label" color="textMuted">
            Étape {step + 1} sur {STEP_TITLES.length} — {STEP_TITLES[step]}
          </AppText>
        </View>

        {categoriesQuery.isLoading || membersQuery.isLoading ? (
          <LoadingSkeleton height={200} radius={theme.radii.lg} />
        ) : (
          <>
            {step === 0 ? (
              <StepBasics control={control} errors={errors} categories={categories} />
            ) : null}
            {step === 1 ? <StepMetadata control={control} category={selectedCategory} /> : null}
            {step === 2 ? (
              <StepReview
                control={control}
                errors={errors}
                members={membersQuery.data ?? []}
                category={selectedCategory}
                householdId={householdId}
                values={values}
              />
            ) : null}
          </>
        )}

        {submitError ? (
          <AppText variant="helper" color="danger">
            {submitError}
          </AppText>
        ) : null}

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {step > 0 ? (
            <Button label="Précédent" variant="ghost" onPress={goBack} disabled={isBusy} />
          ) : null}
          <View style={{ flex: 1 }} />
          {isLastStep ? (
            <Button
              label={mode === 'create' ? 'Ajouter au nid' : 'Enregistrer'}
              onPress={() => void onSubmit()}
              loading={isBusy}
            />
          ) : (
            <Button label="Suivant" onPress={() => void goNext()} disabled={isBusy} />
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}
