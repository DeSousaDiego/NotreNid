import { router } from 'expo-router';
import { View } from 'react-native';

import {
  AppText,
  CategoryIllustration,
  ErrorState,
  LoadingSkeleton,
  ScreenContainer,
} from '../../../components';
import { useCategories } from '../../../hooks/useCategories';
import { getErrorMessage } from '../../../lib/errorMessage';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { SelectionCard } from '../../../screens/add-item/SelectionCard';
import { ADD_ITEM_SUPPORTED_SLUGS } from '../../../screens/item-form/metadataFields';
import { useTheme } from '../../../theme';

type SupportedSlug = (typeof ADD_ITEM_SUPPORTED_SLUGS)[number];

/** Écran « Choisir une catégorie » — point d'entrée du flow d'ajout (Bloc 2). */
export default function AddItemCategoryScreen() {
  const theme = useTheme();
  const { householdId } = useHousehold();
  const categoriesQuery = useCategories(householdId);

  const categories = (categoriesQuery.data ?? [])
    .filter((category): category is typeof category & { slug: SupportedSlug } =>
      ADD_ITEM_SUPPORTED_SLUGS.includes(category.slug as SupportedSlug),
    )
    .sort(
      (a, b) => ADD_ITEM_SUPPORTED_SLUGS.indexOf(a.slug) - ADD_ITEM_SUPPORTED_SLUGS.indexOf(b.slug),
    );

  return (
    <ScreenContainer scroll edges={['top', 'left', 'right', 'bottom']}>
      {/* Premier écran du Stack imbriqué `add-item` (voir add-item/_layout.tsx) : bien
       * qu'il n'ait rien à dépiler DANS ce Stack, `add-item` est lui-même poussé comme
       * écran frère sur le Stack parent `(app)` (voir (app)/_layout.tsx), qui, lui, a un
       * écran précédent (l'onglet ayant déclenché « Ajouter »). React Navigation propage
       * cette information de « retour possible » au Stack imbriqué via un Context
       * indépendant de `headerShown` (vérifié dans le code source d'expo-router) : cet
       * écran hérite donc automatiquement de la même flèche retour native que
       * mode/scan/form, collection/[itemId] et les pages Profil — aucun rendu custom
       * nécessaire ici, contrairement à une tentative précédente qui en ajoutait un. */}
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="title">Ajouter un objet</AppText>
        <AppText variant="body" color="textMuted">
          Que souhaitez-vous ajouter ?
        </AppText>
      </View>

      <View style={{ marginTop: theme.spacing.xl }}>
        {categoriesQuery.isLoading ? (
          <LoadingSkeleton height={220} radius={theme.radii.lg} />
        ) : categoriesQuery.isError ? (
          <ErrorState
            title="Catégories indisponibles"
            message={getErrorMessage(categoriesQuery.error)}
            onRetry={() => void categoriesQuery.refetch()}
          />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {categories.map((category) => (
              <SelectionCard
                key={category.id}
                title={category.name}
                icon={<CategoryIllustration slug={category.slug} size={56} />}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/add-item/mode',
                    params: { categoryId: category.id },
                  })
                }
              />
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
