import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { useTheme } from '../theme';

import { AppText } from './AppText';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Un problème est survenu',
  message,
  onRetry,
}: ErrorStateProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xl,
        gap: theme.spacing.sm,
      }}
    >
      <Ionicons name="alert-circle-outline" size={48} color={theme.colors.danger} />
      <AppText variant="section" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      <AppText variant="body" color="textMuted" style={{ textAlign: 'center' }}>
        {message}
      </AppText>
      {onRetry ? (
        <Button
          label="Réessayer"
          onPress={onRetry}
          variant="primary"
          style={{ marginTop: theme.spacing.sm }}
        />
      ) : null}
    </View>
  );
}
