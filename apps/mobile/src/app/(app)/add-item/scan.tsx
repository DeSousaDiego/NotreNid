import { Ionicons } from '@expo/vector-icons';
import type { BarcodeCategory } from '@notre-nid/api-client';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';

import { AppText, Button, ErrorState, LoadingSkeleton, ScreenContainer } from '../../../components';
import { useCategories } from '../../../hooks/useCategories';
import { useResolveBarcode } from '../../../hooks/useResolveBarcode';
import { getErrorMessage } from '../../../lib/errorMessage';
import { normalizeScannedBarcode, SUPPORTED_BARCODE_TYPES } from '../../../lib/barcodeScanner';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { useAddItemDraft } from '../../../screens/add-item/AddItemDraftContext';
import { buildDraftValuesFromBarcodeResult } from '../../../screens/add-item/barcodeResultMapping';
import { useTheme } from '../../../theme';

type ScanPhase =
  | { kind: 'scanning' }
  | { kind: 'loading' }
  | { kind: 'no_match' }
  | { kind: 'unsupported' }
  | { kind: 'provider_error' }
  | { kind: 'error'; message: string };

function isBarcodeCategory(slug: string): slug is BarcodeCategory {
  return slug === 'book' || slug === 'cd' || slug === 'dvd';
}

function withOpacity(hexColor: string, opacity: number): string {
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hexColor}${alpha}`;
}

/**
 * Écran « Scanner un code-barres » — viseur caméra réel (`expo-camera`,
 * `CameraView`). `router.replace` est utilisé pour CHAQUE sortie de cet écran
 * (succès → formulaire, saisie manuelle, retour catégorie introuvable) : une
 * seule instance de `CameraView` ne peut donc jamais être montée en même
 * temps qu'une autre (voir la recommandation Expo « unmount Camera whenever
 * a screen is unfocused ») — inutile de gérer explicitement le focus de
 * l'écran ici.
 */
export default function AddItemScanScreen() {
  const theme = useTheme();
  const { householdId } = useHousehold();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const categoriesQuery = useCategories(householdId);
  const draft = useAddItemDraft();
  const resolveBarcode = useResolveBarcode();

  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<ScanPhase>({ kind: 'scanning' });
  const [cameraKey, setCameraKey] = useState(0);
  // Verrou synchrone (pas un `useState`) : le module natif peut invoquer
  // `onBarcodeScanned` deux fois pour la même détection avant que React n'ait
  // eu l'occasion de re-rendre avec la prop désactivée — seule une ref, lue
  // et écrite de façon synchrone dans le même gestionnaire, garantit qu'un
  // seul appel de résolution part réellement (voir les tests « double
  // callback »).
  const scanLockRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  // Demande la permission automatiquement au premier accès (jamais qu'une
  // fois : dès que `status` quitte `'undetermined'`, cet effet ne se
  // redéclenche plus) — une redemande explicite après refus passe par
  // `requestPermission` directement (bouton), pas par cet effet.
  useEffect(() => {
    if (permission?.status === 'undetermined') {
      void requestPermission();
    }
  }, [permission?.status, requestPermission]);

  // Un changement de catégorie (l'utilisateur revient en arrière puis choisit
  // une autre catégorie sans que cet écran soit démonté) doit repartir d'un
  // scan neuf : un ancien message no_match/erreur ou un scanner verrouillé
  // pour la catégorie précédente n'ont plus de sens ici. L'état (`phase`,
  // `cameraKey`) est ajusté PENDANT le rendu (pas dans un `useEffect`) —
  // pattern React recommandé pour réinitialiser un état dérivé d'une prop qui
  // change, sans rendu intermédiaire périmé ni cascade d'effets (voir
  // react-hooks/set-state-in-effect). `scanLockRef`, lui, ne peut pas être
  // touché pendant le rendu (voir react-hooks/refs) : un `useLayoutEffect`
  // séparé, synchrone avant toute peinture/évènement, le réinitialise dès que
  // ce même changement est détecté.
  const [resetForCategoryId, setResetForCategoryId] = useState(categoryId);
  if (categoryId !== resetForCategoryId) {
    setResetForCategoryId(categoryId);
    setPhase({ kind: 'scanning' });
    setCameraKey((key) => key + 1);
  }

  useLayoutEffect(() => {
    scanLockRef.current = false;
  }, [resetForCategoryId]);

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

  const goToManualForm = () => {
    router.replace({ pathname: '/(app)/add-item/form', params: { categoryId } });
  };

  const resolve = async (barcode: string) => {
    setPhase({ kind: 'loading' });
    try {
      const result = await resolveBarcode.mutateAsync({ barcode, category: barcodeCategory });
      if (!isMountedRef.current) return;

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

      setPhase({ kind: result.status });
    } catch (error) {
      if (!isMountedRef.current) return;
      setPhase({ kind: 'error', message: getErrorMessage(error) });
    }
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanLockRef.current) return;
    const normalized = normalizeScannedBarcode(result.data);
    if (!normalized) return;
    scanLockRef.current = true;
    void resolve(normalized);
  };

  const handleRescan = () => {
    scanLockRef.current = false;
    setCameraKey((key) => key + 1);
    setPhase({ kind: 'scanning' });
  };

  // --- Permission caméra --------------------------------------------------

  if (!permission || permission.status === 'undetermined') {
    return (
      <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
        <LoadingSkeleton height={220} radius={theme.radii.lg} />
        <AppText
          variant="body"
          color="textMuted"
          style={{ textAlign: 'center', marginTop: theme.spacing.md }}
        >
          Vérification de l’autorisation de la caméra…
        </AppText>
      </ScreenContainer>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
        <View style={{ gap: theme.spacing.lg }}>
          <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
            <Ionicons name="camera-outline" size={64} color={theme.colors.primaryMuted} />
            <AppText variant="section" style={{ textAlign: 'center' }}>
              Accès à la caméra nécessaire
            </AppText>
            <AppText variant="body" color="textMuted" style={{ textAlign: 'center' }}>
              {permission.canAskAgain
                ? 'Notre Nid a besoin de la caméra pour scanner un code-barres.'
                : "L'accès à la caméra a été refusé. Activez-le depuis les réglages de votre téléphone pour scanner un code-barres."}
            </AppText>
          </View>

          {permission.canAskAgain ? (
            <Button
              label="Autoriser l’accès à la caméra"
              onPress={() => void requestPermission()}
            />
          ) : (
            <Button label="Ouvrir les réglages" onPress={() => void Linking.openSettings()} />
          )}

          <Button label="Saisir manuellement à la place" variant="ghost" onPress={goToManualForm} />
        </View>
      </ScreenContainer>
    );
  }

  // --- Résultat de la recherche (caméra non affichée) ---------------------

  if (
    phase.kind === 'no_match' ||
    phase.kind === 'unsupported' ||
    phase.kind === 'provider_error' ||
    phase.kind === 'error'
  ) {
    const message =
      phase.kind === 'no_match'
        ? 'Aucun résultat pour ce code-barres. Vous pouvez réessayer ou saisir les informations manuellement.'
        : phase.kind === 'unsupported'
          ? 'La recherche automatique n’est pas encore disponible pour cette catégorie.'
          : phase.kind === 'provider_error'
            ? 'Le service de recherche est momentanément indisponible. Réessayez dans un instant.'
            : phase.message;

    return (
      <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
        <View style={{ gap: theme.spacing.lg }}>
          <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
            <Ionicons name="barcode-outline" size={64} color={theme.colors.primaryMuted} />
            <AppText
              variant="body"
              color={
                phase.kind === 'provider_error' || phase.kind === 'error' ? 'danger' : 'textMuted'
              }
              style={{ textAlign: 'center' }}
            >
              {message}
            </AppText>
          </View>

          <Button label="Scanner à nouveau" onPress={handleRescan} />
          <Button label="Saisir manuellement à la place" variant="ghost" onPress={goToManualForm} />
        </View>
      </ScreenContainer>
    );
  }

  // --- Viseur caméra (scanning / loading) ----------------------------------

  const isLoading = phase.kind === 'loading';

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']} contentStyle={{ padding: 0 }}>
      <View style={styles.cameraContainer}>
        <CameraView
          key={cameraKey}
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: SUPPORTED_BARCODE_TYPES }}
          onBarcodeScanned={isLoading ? undefined : handleBarcodeScanned}
        />

        <View style={styles.frameLayer} pointerEvents="none">
          <View
            style={[
              styles.frame,
              { borderColor: theme.colors.secondary, borderRadius: theme.radii.lg },
            ]}
          />
          <View
            style={[
              styles.instructionPill,
              {
                backgroundColor: withOpacity(theme.colors.surface, 0.9),
                borderRadius: theme.radii.full,
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.sm,
                marginTop: theme.spacing.lg,
              },
            ]}
          >
            <AppText variant="label" style={{ textAlign: 'center' }}>
              Placez le code-barres dans le cadre
            </AppText>
          </View>
        </View>

        {isLoading ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.loadingOverlay,
              { backgroundColor: withOpacity(theme.colors.text, 0.55) },
            ]}
          >
            <ActivityIndicator color={theme.colors.onPrimary} size="large" />
            <AppText
              variant="body"
              style={{ color: theme.colors.onPrimary, marginTop: theme.spacing.sm }}
            >
              Recherche des informations…
            </AppText>
          </View>
        ) : null}

        <View
          style={[
            styles.footer,
            {
              backgroundColor: withOpacity(theme.colors.surface, 0.9),
              padding: theme.spacing.md,
            },
          ]}
        >
          <Button
            label="Saisir manuellement à la place"
            variant="ghost"
            disabled={isLoading}
            onPress={goToManualForm}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  cameraContainer: {
    flex: 1,
  },
  frameLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: '78%',
    aspectRatio: 1.6,
    borderWidth: 3,
  },
  instructionPill: {
    alignSelf: 'center',
  },
  loadingOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
