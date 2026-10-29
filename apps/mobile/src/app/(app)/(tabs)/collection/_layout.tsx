import { Stack } from 'expo-router';

import { useTheme } from '../../../../theme';

/** L'écran Filtres vit hors des onglets (`(app)/collection/filters`, sans tab bar) ;
 * le filtre partagé est fourni par le layout `(app)`. */
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
    </Stack>
  );
}
