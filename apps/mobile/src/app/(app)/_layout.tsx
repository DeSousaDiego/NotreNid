import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { resolveHouseholdGate } from '../../lib/householdGate';
import { HouseholdCollectionFiltersProvider } from '../../providers/CollectionFiltersProvider';
import { useHousehold } from '../../providers/HouseholdProvider';
import { HouseholdLoadErrorView } from '../../screens/HouseholdLoadErrorView';
import { HouseholdSelectView } from '../../screens/HouseholdSelectView';
import { NoHouseholdView } from '../../screens/NoHouseholdView';
import { useTheme } from '../../theme';
import { useAuth } from '../../providers/AuthProvider';

/**
 * Stack racine du groupe (app) : héberge le `(tabs)` (Accueil/Collection/Ajouter/
 * Statistiques/Profil) et, en écrans frères hors des tabs, le détail/édition d'item, le
 * flow d'ajout (`add-item`, Bloc 2 — sous-Stack imbriqué, voir add-item/_layout.tsx)
 * et les sous-pages Profil — pour que la barre d'onglets se masque naturellement (ils
 * ne sont plus des descendants du <Tabs>) et qu'un bouton retour natif apparaisse,
 * sans hack de `tabBarStyle` ni listener de navigation (Bloc 4). L'écran Filtres de la
 * Collection en fait partie (Lot C) ; le filtre partagé qu'il édite est donc fourni ici,
 * au-dessus de l'onglet Collection et de lui.
 */
export default function AppLayout() {
  const theme = useTheme();
  const { status } = useAuth();
  const { householdId, households, hasData, isError, error, refetch, selectHousehold } =
    useHousehold();

  if (status !== 'authenticated') {
    return <Redirect href="/(auth)/login" />;
  }

  const gate = resolveHouseholdGate({
    hasData,
    isError,
    householdCount: households.length,
    householdId,
  });

  if (gate === 'loading') {
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

  if (gate === 'error') {
    return <HouseholdLoadErrorView error={error} onRetry={refetch} />;
  }

  if (gate === 'empty') {
    return <NoHouseholdView />;
  }

  if (gate === 'select' || !householdId) {
    return <HouseholdSelectView households={households} onSelect={selectHousehold} />;
  }

  return (
    <HouseholdCollectionFiltersProvider householdId={householdId}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontFamily: theme.fonts.semiBold },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add-item" options={{ headerShown: false }} />
        <Stack.Screen name="collection/[itemId]" options={{ title: '' }} />
        <Stack.Screen name="collection/filters" options={{ title: 'Filtres' }} />
        <Stack.Screen name="collection/edit/[itemId]" options={{ title: '' }} />
        <Stack.Screen name="profile/edit" options={{ title: 'Modifier mon profil' }} />
        <Stack.Screen name="profile/members" options={{ title: 'Membres' }} />
        <Stack.Screen name="profile/invitations" options={{ title: 'Invitations' }} />
        <Stack.Screen name="profile/categories" options={{ title: 'Catégories' }} />
        <Stack.Screen name="profile/archives" options={{ title: 'Archives' }} />
        <Stack.Screen name="profile/join" options={{ title: 'Rejoindre un foyer' }} />
      </Stack>
    </HouseholdCollectionFiltersProvider>
  );
}
