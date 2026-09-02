import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useHousehold } from '../../providers/HouseholdProvider';
import { HouseholdSelectView } from '../../screens/HouseholdSelectView';
import { NoHouseholdView } from '../../screens/NoHouseholdView';
import { useTheme } from '../../theme';
import { useAuth } from '../../providers/AuthProvider';

/**
 * Stack racine du groupe (app) : héberge le `(tabs)` (Accueil/Collection/Ajouter/
 * Recherche/Profil) et, en écrans frères hors des tabs, le détail/édition d'item et
 * les sous-pages Profil — pour que la barre d'onglets se masque naturellement (ils
 * ne sont plus des descendants du <Tabs>) et qu'un bouton retour natif apparaisse,
 * sans hack de `tabBarStyle` ni listener de navigation (Bloc 4).
 */
export default function AppLayout() {
  const theme = useTheme();
  const { status } = useAuth();
  const { householdId, households, isLoading, selectHousehold } = useHousehold();

  if (status !== 'authenticated') {
    return <Redirect href="/(auth)/login" />;
  }

  if (isLoading) {
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

  if (households.length === 0) {
    return <NoHouseholdView />;
  }

  if (!householdId) {
    return <HouseholdSelectView households={households} onSelect={selectHousehold} />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontFamily: theme.fonts.semiBold },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="collection/[itemId]" options={{ title: '' }} />
      <Stack.Screen name="collection/edit/[itemId]" options={{ title: '' }} />
      <Stack.Screen name="profile/edit" options={{ title: 'Modifier mon profil' }} />
      <Stack.Screen name="profile/members" options={{ title: 'Membres' }} />
      <Stack.Screen name="profile/invitations" options={{ title: 'Invitations' }} />
      <Stack.Screen name="profile/categories" options={{ title: 'Catégories' }} />
      <Stack.Screen name="profile/archives" options={{ title: 'Archives' }} />
      <Stack.Screen name="profile/join" options={{ title: 'Rejoindre un foyer' }} />
    </Stack>
  );
}
