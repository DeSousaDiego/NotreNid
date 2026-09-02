import {
  NunitoSans_400Regular,
  NunitoSans_500Medium,
  NunitoSans_600SemiBold,
} from '@expo-google-fonts/nunito-sans';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ErrorState, ToastProvider } from '../components';
import { AuthProvider, useAuth } from '../providers/AuthProvider';
import { HouseholdProvider } from '../providers/HouseholdProvider';
import { QueryProvider } from '../providers/QueryProvider';
import { ThemeProvider, useTheme } from '../theme';

void SplashScreen.preventAutoHideAsync();

/**
 * Redirection explicite plutôt que le simple montage/démontage conditionnel
 * des groupes de routes : plus fiable que de compter sur expo-router pour
 * renaviguer tout seul quand l'écran actuellement focus disparaît de l'arbre
 * (constaté peu fiable en pratique — le changement d'état n'était parfois
 * répercuté à l'écran qu'après une mise en arrière-plan/premier plan).
 */
function RootNavigator() {
  const { status, retryRestore } = useAuth();
  const theme = useTheme();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    } else if (status === 'unauthenticated') {
      router.replace('/(auth)/login');
    }
  }, [status]);

  if (status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (status === 'restore-error') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ErrorState
          title="Connexion impossible"
          message="Impossible de joindre le service. Vérifiez votre connexion et réessayez."
          onRetry={retryRestore}
        />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    NunitoSans_400Regular,
    NunitoSans_500Medium,
    NunitoSans_600SemiBold,
  });

  const ready = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <ThemeProvider fontsLoaded={fontsLoaded}>
      <ToastProvider>
        <QueryProvider>
          <AuthProvider>
            <HouseholdProvider>
              <RootNavigator />
            </HouseholdProvider>
          </AuthProvider>
        </QueryProvider>
      </ToastProvider>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
