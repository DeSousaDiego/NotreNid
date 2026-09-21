import { Ionicons } from '@expo/vector-icons';
import type { BarcodeCategory } from '@notre-nid/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Button,
  ErrorState,
  LoadingSkeleton,
  ScreenContainer,
  TextField,
} from '../../../components';
import { useCategories } from '../../../hooks/useCategories';
import { useResolveBarcode } from '../../../hooks/useResolveBarcode';
import { getErrorMessage } from '../../../lib/errorMessage';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { useAddItemDraft } from '../../../screens/add-item/AddItemDraftContext';
import { buildDraftValuesFromBarcodeResult } from '../../../screens/add-item/barcodeResultMapping';
import { useTheme } from '../../../theme';

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'no_match' }
  | { kind: 'unsupported' }
  | { kind: 'provider_error' }
  | { kind: 'error'; message: string };

function isBarcodeCategory(slug: string): slug is BarcodeCategory {
  return slug === 'book' || slug === 'cd' || slug === 'dvd';
}

/**
 * Bloc 3A — pas de build EAS/Android Studio disponible pour intégrer
 * `expo-camera` pour l'instant (voir docs/DECISIONS.md) : cet écran remplace
 * temporairement le viseur caméra par une saisie manuelle du code-barres,
 * pour développer et tester tout le flow de résolution (endpoint, fallback de
 * fournisseurs, préremplissage du brouillon) sans dépendance native. La
 * catégorie étant déjà connue à ce stade du flow (Catégorie → Mode → Scan),
 * cet écran sait directement quelle recherche effectuer — aucune détection de
 * type de produit ici. Le futur scanner caméra remplacera uniquement la
 * saisie ci-dessous par un viseur ; le reste (appel API, mapping vers le
 * brouillon, navigation) est déjà l'architecture définitive.
 */
export default function AddItemScanScreen() {
  const theme = useTheme();
  const { householdId } = useHousehold();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const categoriesQuery = useCategories(householdId);
  const draft = useAddItemDraft();
  const resolveBarcode = useResolveBarcode();

  const [barcodeInput, setBarcodeInput] = useState('');
  const [state, setState] = useState<SearchState>({ kind: 'idle' });

  const category = categoriesQuery.data?.find((c) => c.id === categoryId);

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

  if (!category || !isBarcodeCategory(category.slug)) {
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

  const barcodeCategory = category.slug as BarcodeCategory;
  const isSearching = state.kind === 'loading';

  const handleSearch = async () => {
    const trimmed = barcodeInput.trim();
    if (!trimmed) return;

    setState({ kind: 'loading' });
    try {
      const result = await resolveBarcode.mutateAsync({
        barcode: trimmed,
        category: barcodeCategory,
      });

      if (result.status === 'matched' || result.status === 'partial') {
        // Ne préremplit jamais condition/rating/notes/owners — voir
        // `buildDraftValuesFromBarcodeResult`. Pas d'auto-save : on ne fait que
        // naviguer vers le formulaire existant, la création reste un geste
        // explicite de l'utilisateur. `partial` (propre à `dvd`) ouvre le
        // MÊME formulaire, jamais un écran différent ni une modale bloquante
        // — seul un bandeau inline y indique que certaines informations
        // restent à vérifier (voir `AddItemDraftContext.partialWarning` et
        // `add-item/form.tsx`).
        draft.setValues(buildDraftValuesFromBarcodeResult(result), {
          partial: result.status === 'partial',
        });
        router.replace({ pathname: '/(app)/add-item/form', params: { categoryId } });
        return;
      }

      setState({ kind: result.status });
    } catch (error) {
      setState({ kind: 'error', message: getErrorMessage(error) });
    }
  };

  return (
    <ScreenContainer
      scroll
      androidKeyboardBehavior="height"
      edges={['top', 'left', 'right', 'bottom']}
    >
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
          <Ionicons name="barcode-outline" size={64} color={theme.colors.primaryMuted} />
          <AppText variant="section" style={{ textAlign: 'center' }}>
            Rechercher par code-barres
          </AppText>
          <AppText variant="body" color="textMuted" style={{ textAlign: 'center' }}>
            Le scanner caméra arrive dans une prochaine mise à jour — saisissez le code-barres pour
            tester la recherche dès maintenant.
          </AppText>
        </View>

        <TextField
          label="Code-barres"
          value={barcodeInput}
          onChangeText={setBarcodeInput}
          keyboardType="number-pad"
          placeholder="Ex. 9782070368228"
          maxLength={32}
          editable={!isSearching}
        />

        <Button
          label="Rechercher"
          onPress={() => void handleSearch()}
          loading={isSearching}
          disabled={!barcodeInput.trim() || isSearching}
        />

        {state.kind === 'no_match' ? (
          <AppText variant="body" color="textMuted" style={{ textAlign: 'center' }}>
            Aucun résultat pour ce code-barres. Vous pouvez réessayer ou saisir les informations
            manuellement.
          </AppText>
        ) : null}
        {state.kind === 'unsupported' ? (
          <AppText variant="body" color="textMuted" style={{ textAlign: 'center' }}>
            La recherche automatique n’est pas encore disponible pour cette catégorie.
          </AppText>
        ) : null}
        {state.kind === 'provider_error' ? (
          <AppText variant="body" color="danger" style={{ textAlign: 'center' }}>
            Le service de recherche est momentanément indisponible. Réessayez dans un instant.
          </AppText>
        ) : null}
        {state.kind === 'error' ? (
          <AppText variant="body" color="danger" style={{ textAlign: 'center' }}>
            {state.message}
          </AppText>
        ) : null}

        <Button
          label="Saisir manuellement à la place"
          variant="ghost"
          disabled={isSearching}
          onPress={() =>
            router.replace({ pathname: '/(app)/add-item/form', params: { categoryId } })
          }
        />
      </View>
    </ScreenContainer>
  );
}
