import { useLocalSearchParams } from 'expo-router';

import { ErrorState, LoadingSkeleton, ScreenContainer } from '../../../../components';
import { useItem } from '../../../../hooks/useItem';
import { getErrorMessage } from '../../../../lib/errorMessage';
import { useHousehold } from '../../../../providers/HouseholdProvider';
import { ItemFormScreen } from '../../../../screens/item-form/ItemFormScreen';
import { useTheme } from '../../../../theme';

/**
 * `category` est désormais une prop fixe d'`ItemFormScreen` (Bloc 2, plus de
 * sélecteur interne) : ce wrapper la dérive de l'item chargé. `useItem` est aussi
 * appelé en interne par `ItemFormScreen` avec la même clé — React Query dédoublonne,
 * une seule requête réseau — ce qui garde `ItemFormScreen` agnostique du fait qu'il
 * serve la création ou l'édition.
 */
export default function EditItemScreen() {
  const theme = useTheme();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { householdId } = useHousehold();
  const itemQuery = useItem(householdId, itemId);

  if (itemQuery.isLoading) {
    return (
      <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
        <LoadingSkeleton height={220} radius={theme.radii.lg} />
      </ScreenContainer>
    );
  }

  if (itemQuery.isError || !itemQuery.data) {
    return (
      <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
        <ErrorState
          title="Objet introuvable"
          message={itemQuery.error ? getErrorMessage(itemQuery.error) : "Cet objet n'existe pas."}
          onRetry={() => void itemQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  return <ItemFormScreen mode="edit" itemId={itemId} category={itemQuery.data.category} />;
}
