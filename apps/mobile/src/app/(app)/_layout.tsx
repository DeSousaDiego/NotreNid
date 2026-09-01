import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View, type ColorValue } from 'react-native';

import { useHousehold } from '../../providers/HouseholdProvider';
import { HouseholdSelectView } from '../../screens/HouseholdSelectView';
import { NoHouseholdView } from '../../screens/NoHouseholdView';
import { useTheme } from '../../theme';
import type { Theme } from '../../theme/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';

/**
 * Icône d'onglet avec un halo léger derrière l'icône active : seul repère visuel
 * ajouté en plus de la couleur, pour que l'onglet courant reste identifiable
 * même pour un utilisateur peu sensible à la teinte (docs/NOTRE_NID_PRD.md
 * section 4.1, « états non communiqués uniquement par la couleur »).
 */
function TabIcon({
  name,
  color,
  size,
  focused,
  theme,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: ColorValue;
  size: number;
  focused: boolean;
  theme: Theme;
}) {
  const haloSize = size + 20;
  return (
    <View
      style={{
        width: haloSize,
        height: haloSize,
        borderRadius: haloSize / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? `${theme.colors.secondary}1F` : 'transparent',
      }}
    >
      <Ionicons name={name} size={size} color={color} />
    </View>
  );
}

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
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.secondary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: { fontFamily: theme.fonts.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="home-outline"
              size={size}
              color={color}
              focused={focused}
              theme={theme}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="albums-outline"
              size={size}
              color={color}
              focused={focused}
              theme={theme}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Ajouter',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="add-circle" size={size} color={color} focused={focused} theme={theme} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Recherche',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="search-outline"
              size={size}
              color={color}
              focused={focused}
              theme={theme}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="person-outline"
              size={size}
              color={color}
              focused={focused}
              theme={theme}
            />
          ),
        }}
      />
    </Tabs>
  );
}
