import { Stack } from 'expo-router';

import { useTheme } from '../../../theme';

export default function ProfileLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontFamily: theme.fonts.semiBold },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Profil' }} />
      <Stack.Screen name="members" options={{ title: 'Membres' }} />
      <Stack.Screen name="invitations" options={{ title: 'Invitations' }} />
      <Stack.Screen name="categories" options={{ title: 'Catégories' }} />
      <Stack.Screen name="archives" options={{ title: 'Archives' }} />
      <Stack.Screen name="join" options={{ title: 'Rejoindre un foyer' }} />
    </Stack>
  );
}
