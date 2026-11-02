import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme';

import { ErrorState } from './ErrorState';

interface AppErrorBoundaryState {
  error: Error | null;
}

/**
 * Dernier filet de sécurité (Release 0B) : une exception React inattendue pendant le rendu
 * affiche un écran Notre Nid avec « Réessayer », au lieu d'un écran blanc.
 *
 * Ne capture QUE les erreurs de rendu : les erreurs réseau/API restent gérées par TanStack
 * Query et les ErrorState des écrans (aucune requête n'utilise `throwOnError`).
 * « Réessayer » remonte l'arbre enfant à neuf ; si l'erreur persiste, l'écran revient.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[AppErrorBoundary] rendu interrompu', error, info.componentStack);
    }
  }

  private readonly retry = () => {
    this.setState({ error: null });
  };

  override render() {
    if (this.state.error) {
      return <AppErrorFallback onRetry={this.retry} />;
    }
    return this.props.children;
  }
}

function AppErrorFallback({ onRetry }: { onRetry: () => void }) {
  const theme = useTheme();
  return (
    <View testID="app-error-boundary" style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ErrorState
        title="Un petit souci dans le nid"
        message="Une erreur inattendue s’est produite. Réessayez ; si le problème persiste, relancez l’application."
        onRetry={onRetry}
      />
    </View>
  );
}
