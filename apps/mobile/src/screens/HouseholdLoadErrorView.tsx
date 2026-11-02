import { View } from 'react-native';

import { ErrorState } from '../components';
import { getErrorMessage } from '../lib/errorMessage';
import { useTheme } from '../theme';

/**
 * La liste des foyers n'a pas pu être chargée et aucune donnée n'est disponible : on
 * propose de réessayer, jamais de créer un foyer (voir lib/householdGate).
 */
export function HouseholdLoadErrorView({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ErrorState
        title="Votre nid est momentanément inaccessible"
        message={getErrorMessage(error)}
        onRetry={onRetry}
      />
    </View>
  );
}
