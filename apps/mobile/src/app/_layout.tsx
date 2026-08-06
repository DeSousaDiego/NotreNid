import {
  NunitoSans_400Regular,
  NunitoSans_500Medium,
  NunitoSans_600SemiBold,
} from '@expo-google-fonts/nunito-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { ErrorState, ToastProvider } from '../components';
import { AuthProvider, useAuth } from '../providers/AuthProvider';
import { HouseholdProvider } from '../providers/HouseholdProvider';
import { QueryProvider } from '../providers/QueryProvider';
import { ThemeProvider, useTheme } from '../theme';

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status, retryRestore } = useAuth();
  const theme = useTheme();

  if (status === 'loading') {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
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
      {status === 'authenticated' ? <Stack.Screen name="(app)" /> : <Stack.Screen name="(auth)" />}
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
