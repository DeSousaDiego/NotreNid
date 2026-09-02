import { zodResolver } from '@hookform/resolvers/zod';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues,
    values: mode === 'edit' && itemQuery.data ? defaultValues : undefined,
  });

  // Formulaire neuf à chaque nouvelle visite de "Ajouter" (Bloc 4) : l'onglet n'est
  // jamais démonté par Expo Router (les tabs restent montés en arrière-plan), donc
  // sans ce nettoyage les valeurs du dernier item saisi persistaient d'une visite à
  // l'autre. Le cleanup ne s'exécute qu'à la perte de focus d'un vrai changement
  // d'onglet — jamais pendant un simple re-render — donc la progression normale
  // entre les 3 étapes du wizard (setStep, sans perte de focus) n'est jamais
  // affectée. Remettre `step` à 0 démonte `StepReview`/le sélecteur de couverture
  // (rendu conditionnellement), ce qui décharge aussi leur état local au passage.
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (mode === 'create') {
          reset(EMPTY_ITEM_FORM_VALUES);
          setStep(0);
          setSubmitError(null);
        }
      };
    }, [mode, reset]),
  );

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
  // V1 se limite aux 3 catégories système (Bloc 4) : le sélecteur de l'étape 1 n'offre
  // que celles-ci. `categories`/`selectedCategory` restent basés sur la liste complète
  // pour ne pas casser l'édition d'un item existant dont la catégorie personnalisée
  // (créée avant cette simplification) ne serait plus proposée à la création.
  const systemCategories = categories.filter((category) => category.isSystem);

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

  // Sans catégories, l'étape 1 est bloquante (impossible de choisir une catégorie, donc
  // impossible de continuer) — une erreur réseau ne doit jamais se traduire silencieusement
  // par un sélecteur vide sans explication.
  if (categoriesQuery.isError) {
    return (
      <ScreenContainer>
        <ErrorState
          title="Catégories indisponibles"
          message={getErrorMessage(categoriesQuery.error)}
          onRetry={() => void categoriesQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  if (membersQuery.isError) {
    return (
      <ScreenContainer>
        <ErrorState
          title="Membres indisponibles"
          message={getErrorMessage(membersQuery.error)}
          onRetry={() => void membersQuery.refetch()}
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
              <StepBasics control={control} errors={errors} categories={systemCategories} />
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
