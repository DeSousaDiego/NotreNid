import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { router, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { BackHandler, View } from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import type { Category } from '@notre-nid/shared';

import {
  AppText,
  Button,
  ConfirmDialog,
  ErrorState,
  LoadingSkeleton,
  ScreenContainer,
  useToast,
} from '../../components';
import { useCreateItem, useUpdateItem } from '../../hooks/useItemMutations';
import { useItem } from '../../hooks/useItem';
import { useMembers } from '../../hooks/useMembers';
import { getErrorMessage } from '../../lib/errorMessage';
import { useHousehold } from '../../providers/HouseholdProvider';
import { useTheme } from '../../theme';

import { categoryAddTitle } from './metadataFields';
import {
  buildItemPayload,
  buildItemUpdatePayload,
  EMPTY_ITEM_FORM_VALUES,
  findMissingRequiredCustomFields,
  itemFormSchema,
  itemToFormValues,
  type ItemFormValues,
} from './schema';
import { StepCopy } from './StepCopy';
import { StepInformation } from './StepInformation';
import { StepOwnersAndCover } from './StepOwnersAndCover';
import { leaveAddFlowToCollection } from './successNavigation';

export interface ItemFormScreenProps {
  mode: 'create' | 'edit';
  /** Catégorie fixe pour la durée du montage de l'écran — choisie en amont (écran
   * « Choisir une catégorie » en création, item existant en édition). Ce composant ne
   * permet plus de la changer lui-même (Bloc 2) : voir `onChangeCategoryPress`. */
  category: Category;
  itemId?: string;
  /** Brouillon à reprendre (création uniquement) — vient du `AddItemDraftContext` du
   * flow d'ajout, et sera plus tard le point d'injection des valeurs pré-remplies par
   * le scanner. Lu une seule fois, au montage (voir `useForm({ defaultValues })`) :
   * ne doit jamais changer de référence après coup sous peine de réinitialiser le
   * formulaire en cours de saisie — c'est la responsabilité de l'appelant. */
  initialValues?: Partial<ItemFormValues>;
  /** Miroir des valeurs courantes vers l'appelant (synchronisation du brouillon). */
  onValuesChange?: (values: ItemFormValues) => void;
  /** Si fourni, affiche un lien discret « Changer » à côté du contexte catégorie
   * (étape 1). Laissé `undefined` en édition — pas de changement de catégorie là. */
  onChangeCategoryPress?: () => void;
  /** Bandeau inline discret affiché au-dessus des étapes, jamais bloquant
   * (pas de modale) — générique, pas spécifique au scan DVD/`partial` : tout
   * appelant peut l'utiliser pour signaler que certaines données pré-remplies
   * méritent vérification. Visible à chaque étape tant que fourni (le
   * propriétaire du formulaire n'est pas censé avoir déjà tout relu à la
   * première étape). */
  infoMessage?: string;
}

const STEP_TITLES = ['Informations', 'Votre exemplaire', 'Propriétaires et couverture'];

// Utilisé pour les états sans footer (chargement/erreur) — la zone de sécurité basse
// y est gérée par `SafeAreaView` seule.
const SCREEN_EDGES: Edge[] = ['top', 'left', 'right', 'bottom'];
// Rendu principal : le footer (boutons Précédent/Suivant, toujours visible, même
// clavier ouvert — voir plus bas) gère lui-même sa zone de sécurité basse via
// `useSafeAreaInsets` (même convention que `collection/filters.tsx`) ; l'inclure aussi
// ici doublerait ce padding.
const FORM_SCREEN_EDGES: Edge[] = ['top', 'left', 'right'];

type PreventedNavigationAction = Parameters<
  Parameters<typeof usePreventRemove>[1]
>[0]['data']['action'];

/**
 * Sortie confirmée (« Quitter sans enregistrer ») : exécutée dans un effet, APRÈS
 * le rendu qui désarme `usePreventRemove` (`exitIntent !== null`), avec l'action
 * de navigation d'origine. Les sorties après succès, elles, ne passent PAS par ici :
 * voir `leaveAfterSuccess`.
 */
type ExitIntent = { kind: 'discard'; action: PreventedNavigationAction };

function mergeWithEmpty(partial: Partial<ItemFormValues> | undefined): ItemFormValues {
  return {
    ...EMPTY_ITEM_FORM_VALUES,
    ...partial,
    metadata: { ...EMPTY_ITEM_FORM_VALUES.metadata, ...partial?.metadata },
    // `useWatch` (mode contrôlé, sans `name`) type ses valeurs comme potentiellement
    // `undefined` même pour un `Record<string, string>` — le cast reflète que RHF
    // ne renvoie jamais une entrée réellement `undefined` ici (seulement absente).
    customMetadata: {
      ...EMPTY_ITEM_FORM_VALUES.customMetadata,
      ...partial?.customMetadata,
    } as Record<string, string>,
  };
}

function ItemFormScreenComponent({
  mode,
  category,
  itemId,
  initialValues,
  onValuesChange,
  onChangeCategoryPress,
  infoMessage,
}: ItemFormScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { householdId } = useHousehold();
  const membersQuery = useMembers(householdId);
  const itemQuery = useItem(mode === 'edit' ? householdId : null, itemId ?? '');
  const createItem = useCreateItem(householdId);
  const updateItem = useUpdateItem(householdId);

  const navigation = useNavigation();
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  // Soumission en cours (posé de façon synchrone au premier appui) : désarme la
  // garde de retour arrière DÈS LE DÉBUT de l'envoi, pas au succès — voir
  // `shouldGuardRemoval` et `leaveAfterSuccess`.
  const [isSubmitInFlight, setIsSubmitInFlight] = useState(false);
  const [exitIntent, setExitIntent] = useState<ExitIntent | null>(null);
  const [pendingDiscardAction, setPendingDiscardAction] =
    useState<PreventedNavigationAction | null>(null);
  // Verrou synchrone (même principe que `scanLockRef` du scan) : `isBusy` ne
  // désactive le bouton qu'au rendu suivant — deux appuis dans la même frame
  // enverraient sinon deux créations/mises à jour.
  const submitLockRef = useRef(false);
  const submitSucceededRef = useRef(false);
  const hasLeftAfterSuccessRef = useRef(false);
  // Verrou d'upload lu de façon synchrone (le state `isUploadingCover` ne sert
  // qu'à l'affichage) : `useCoverPicker` le pose avant tout `await`, dès l'appui
  // sur une source d'image — aucune fenêtre où un appui sur « Précédent » ou le
  // CTA final partirait avant que le rendu n'ait désactivé les boutons.
  const uploadLockRef = useRef(false);
  const handleUploadingChange = useCallback((isUploading: boolean) => {
    uploadLockRef.current = isUploading;
    setIsUploadingCover(isUploading);
  }, []);

  // Mémoïsé : `values` ci-dessous (RHF, mode édition) ne doit se resynchroniser que
  // lorsque l'item chargé change réellement, jamais à chaque rendu — un nouvel objet
  // à chaque frappe y causerait une réinitialisation permanente du formulaire édité.
  // `initialValues` est par contrat figé par l'appelant (voir la prop) : l'inclure ici
  // ne provoque donc de recalcul qu'au tout premier rendu.
  const defaultValues = useMemo(
    () =>
      mode === 'edit' && itemQuery.data
        ? itemToFormValues(itemQuery.data)
        : mergeWithEmpty(initialValues),
    [mode, itemQuery.data, initialValues],
  );

  const {
    control,
    handleSubmit,
    trigger,
    clearErrors,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues,
    values: mode === 'edit' && itemQuery.data ? defaultValues : undefined,
  });

  // `useWatch` without a `name` types every field as optional (it can genuinely
  // be partial while async default values are still loading in edit mode) —
  // merge with empty defaults so the rest of this screen can rely on the full
  // `ItemFormValues` shape. Purely for rendering (recap in StepOwnersAndCover) —
  // NOT used to drive the draft sync below, on purpose (see comment there).
  const watched = useWatch<ItemFormValues>({ control });
  const values = mergeWithEmpty(watched as Partial<ItemFormValues>);

  // Synchronise le brouillon du flow d'ajout — structurellement protégé contre toute
  // boucle, indépendamment de `React.memo` sur ce composant (qui reste une
  // optimisation, pas la garantie). `watch(callback)` est une souscription RHF
  // directe au store interne du formulaire : son callback n'est invoqué que lors
  // d'une mutation RHF réelle (saisie, `setValue`…), jamais en réaction à un rendu
  // React déclenché par le parent (contrairement à `useWatch`/`values` ci-dessus,
  // qui produisent un nouvel objet à *chaque* rendu et ne peuvent donc pas servir de
  // dépendance d'effet fiable). `watch` est une référence stable retournée par RHF
  // (jamais recréée entre les rendus) : cet effet ne (ré)abonne donc qu'au montage
  // et au démontage, jamais à chaque rendu. Aucune deep-equality, aucun
  // `JSON.stringify`, aucun mode contrôlé, aucune réinjection d'`initialValues`.
  useEffect(() => {
    if (mode !== 'create') return;
    // react-hooks/incompatible-library : le React Compiler ne peut pas auto-mémoïser
    // le retour de `watch()` (API react-hook-form) — attendu et sans incidence ici,
    // cet effet ne dépend d'aucune valeur mémoïsée par le compilateur.
    // eslint-disable-next-line react-hooks/incompatible-library
    const subscription = watch((value) => {
      onValuesChange?.(mergeWithEmpty(value as Partial<ItemFormValues>));
    });
    return () => subscription.unsubscribe();
  }, [mode, watch, onValuesChange]);

  const isBusy = isSubmitting || createItem.isPending || updateItem.isPending;

  // Retour système (Android), bouton retour du header et geste de retour iOS (la
  // native stack bloque le swipe tant que la garde est active et renvoie
  // l'intention ici) : revient d'abord à l'étape précédente ; à l'étape 1 en
  // édition, confirme avant d'abandonner des modifications non enregistrées. En
  // création, l'étape 1 quitte librement — le brouillon survit dans
  // `AddItemDraftContext` tant qu'on reste dans le flow.
  //
  // Désarmée pendant toute soumission (`isSubmitInFlight`) : la navigation de
  // succès part ainsi d'un écran déjà non gardé depuis au moins un aller-retour
  // réseau, exactement comme avant l'introduction de cette garde — jamais dans
  // la même frame qu'un changement d'état de prévention (écran noir constaté sur
  // appareil quand la garde était désarmée au moment même du succès).
  const shouldGuardRemoval =
    exitIntent === null && !isSubmitInFlight && (step > 0 || (mode === 'edit' && isDirty));
  usePreventRemove(shouldGuardRemoval, ({ data }) => {
    // Rien ne bouge pendant un envoi de couverture : ni étape, ni sortie.
    if (isBusy || uploadLockRef.current) return;
    if (step > 0) {
      setSubmitError(null);
      setStep((current) => Math.max(current - 1, 0));
      return;
    }
    setPendingDiscardAction(data.action);
  });

  // Pendant la soumission, la garde est désarmée : le bouton retour Android est
  // bloqué ici, en JS pur (aucun état de prévention natif modifié).
  useEffect(() => {
    if (!isSubmitInFlight) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [isSubmitInFlight]);

  useEffect(() => {
    if (exitIntent) navigation.dispatch(exitIntent.action);
  }, [exitIntent, navigation]);

  if (mode === 'edit' && itemQuery.isLoading) {
    return (
      <ScreenContainer edges={SCREEN_EDGES}>
        <LoadingSkeleton height={220} radius={theme.radii.lg} />
      </ScreenContainer>
    );
  }

  if (mode === 'edit' && (itemQuery.isError || !itemQuery.data)) {
    return (
      <ScreenContainer edges={SCREEN_EDGES}>
        <ErrorState
          title="Objet introuvable"
          message={itemQuery.error ? getErrorMessage(itemQuery.error) : "Cet objet n'existe pas."}
          onRetry={() => void itemQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  if (membersQuery.isError) {
    return (
      <ScreenContainer edges={SCREEN_EDGES}>
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
      const valid = await trigger(['title']);
      if (!valid) return;
      const missing = findMissingRequiredCustomFields(category, values.customMetadata);
      if (missing.length > 0) {
        setSubmitError(`Champs requis manquants : ${missing.join(', ')}.`);
        return;
      }
    }
    if (step === 1) {
      const valid = await trigger(['condition']);
      if (!valid) return;
    }
    setSubmitError(null);
    setStep((current) => Math.min(current + 1, STEP_TITLES.length - 1));
  };

  const goBack = () => {
    if (uploadLockRef.current) return;
    setSubmitError(null);
    setStep((current) => Math.max(current - 1, 0));
  };

  /**
   * Navigation après succès : directement depuis le gestionnaire (même chemin
   * qu'avant la garde de retour, validé sur appareil), une seule fois, depuis un
   * écran dont la garde est déjà désarmée depuis le début de la soumission.
   */
  const leaveAfterSuccess = (target: 'collection' | 'previous') => {
    if (hasLeftAfterSuccessRef.current) return;
    hasLeftAfterSuccessRef.current = true;
    if (target === 'collection') leaveAddFlowToCollection();
    else router.back();
  };

  const onSubmit = handleSubmit(async (formValues) => {
    setSubmitError(null);

    try {
      if (mode === 'create') {
        await createItem.mutateAsync(buildItemPayload(formValues, category));
        submitSucceededRef.current = true;
        showToast('Cet objet a rejoint votre nid.', 'success');
        leaveAfterSuccess('collection');
      } else if (itemId && itemQuery.data) {
        // `null` explicite pour un champ facultatif vidé : comparé à l'item tel que
        // chargé à l'ouverture (voir `buildItemUpdatePayload`).
        const input = buildItemUpdatePayload(
          formValues,
          category,
          itemToFormValues(itemQuery.data),
        );
        await updateItem.mutateAsync({ itemId, input });
        submitSucceededRef.current = true;
        showToast('Objet modifié.', 'success');
        leaveAfterSuccess('previous');
      }
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  });

  const submit = async () => {
    if (submitLockRef.current || uploadLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitInFlight(true);
    try {
      await onSubmit();
    } finally {
      // Relâchés après un échec (validation ou API) pour permettre de réessayer —
      // la garde se réarme ; conservés après un succès, l'écran se ferme.
      if (!submitSucceededRef.current) {
        submitLockRef.current = false;
        setIsSubmitInFlight(false);
      }
    }
  };

  const isLastStep = step === STEP_TITLES.length - 1;

  return (
    <ScreenContainer
      scroll
      edges={FORM_SCREEN_EDGES}
      androidKeyboardBehavior="height"
      footer={
        // Frère du ScrollView, jamais un enfant scrollable (voir ScreenContainer) : le
        // CTA "Suivant"/"Ajouter au nid" reste donc toujours atteignable, y compris
        // clavier ouvert ou après avoir scrollé loin dans une étape chargée — avant ce
        // correctif, ces boutons faisaient partie du contenu scrollable et pouvaient se
        // retrouver hors champ (bug constaté en test manuel Android).
        <View
          style={{
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.sm,
            paddingBottom: insets.bottom + theme.spacing.sm,
            backgroundColor: theme.colors.background,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          }}
        >
          {/* Erreur de soumission ancrée au footer, jamais dans le contenu défilant :
           * toujours visible au moment où l'utilisateur vient d'appuyer, jusqu'à la
           * prochaine tentative (remise à zéro au début de chaque essai). */}
          {submitError ? (
            <View
              testID="item-form-submit-error"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.xs }}
            >
              <Ionicons
                name="alert-circle-outline"
                size={theme.iconSizes.md}
                color={theme.colors.danger}
              />
              <AppText variant="label" color="danger" style={{ flex: 1 }}>
                {submitError}
              </AppText>
            </View>
          ) : isUploadingCover ? (
            <AppText variant="helper" color="textMuted" accessibilityLiveRegion="polite">
              Envoi de la couverture en cours… Patientez avant de continuer.
            </AppText>
          ) : null}
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {step > 0 ? (
              <Button
                label="Précédent"
                variant="ghost"
                onPress={goBack}
                disabled={isBusy || isUploadingCover}
              />
            ) : null}
            <View style={{ flex: 1 }} />
            {isLastStep ? (
              <Button
                label={mode === 'create' ? 'Ajouter au nid' : 'Enregistrer'}
                onPress={() => void submit()}
                loading={isBusy}
                disabled={isUploadingCover}
              />
            ) : (
              <Button label="Suivant" onPress={() => void goNext()} disabled={isBusy} />
            )}
          </View>
        </View>
      }
    >
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="title">
            {mode === 'create' ? categoryAddTitle(category) : "Modifier l'objet"}
          </AppText>
          <AppText variant="label" color="textMuted">
            Étape {step + 1} sur {STEP_TITLES.length} — {STEP_TITLES[step]}
          </AppText>
        </View>

        {infoMessage ? (
          <View
            accessibilityRole="text"
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: theme.spacing.sm,
              padding: theme.spacing.sm,
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            }}
          >
            <Ionicons
              name="information-circle-outline"
              size={theme.iconSizes.md}
              color={theme.colors.accent}
            />
            <AppText variant="body" color="textMuted" style={{ flex: 1 }}>
              {infoMessage}
            </AppText>
          </View>
        ) : null}

        {membersQuery.isLoading ? (
          <LoadingSkeleton height={200} radius={theme.radii.lg} />
        ) : (
          <>
            {step === 0 ? (
              <StepInformation
                control={control}
                errors={errors}
                category={category}
                onChangeCategoryPress={onChangeCategoryPress}
              />
            ) : null}
            {step === 1 ? <StepCopy control={control} errors={errors} /> : null}
            {step === 2 ? (
              <StepOwnersAndCover
                control={control}
                errors={errors}
                members={membersQuery.data ?? []}
                category={category}
                householdId={householdId}
                values={values}
                onUploadingChange={handleUploadingChange}
              />
            ) : null}
          </>
        )}
      </View>

      <ConfirmDialog
        visible={pendingDiscardAction !== null}
        title="Quitter sans enregistrer ?"
        message="Vos modifications sur cet objet seront perdues."
        confirmLabel="Quitter sans enregistrer"
        cancelLabel="Continuer la modification"
        // Libellés longs : empilés pleine largeur, jamais côte à côte sur mobile.
        actionsLayout="stacked"
        destructive
        onConfirm={() => {
          const action = pendingDiscardAction;
          setPendingDiscardAction(null);
          if (action) setExitIntent({ kind: 'discard', action });
        }}
        onCancel={() => setPendingDiscardAction(null)}
      />
    </ScreenContainer>
  );
}

/**
 * Mémoïsé à titre d'optimisation (évite un rendu inutile de tout l'arbre de
 * l'étape courante quand le parent se re-rend sans qu'aucune prop n'ait
 * changé) — mais ce n'est plus la garantie contre la boucle de rendu
 * `add-item/form.tsx` ↔ `AddItemDraftContext` : cette garantie est désormais
 * structurelle, portée par la souscription `watch(callback)` ci-dessus
 * (indépendante du cycle de rendu React), pas par ce `memo`. Un test de
 * régression (`ItemFormScreen.test.tsx`) force explicitement des rendus du
 * parent avec des props changeantes — donc en contournant ce `memo` — pour
 * vérifier que la protection tient quand même.
 */
export const ItemFormScreen = memo(ItemFormScreenComponent);
