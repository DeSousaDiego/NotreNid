import { Stack } from 'expo-router';

import { useTheme } from '../../../theme';

export default function CollectionLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Collection' }} />
      <Stack.Screen name="[itemId]" options={{ title: '' }} />
      <Stack.Screen name="edit/[itemId]" options={{ title: '' }} />
    </Stack>
  );
}
