import { Stack } from 'expo-router';

import { CollectionFiltersProvider } from '../../../../providers/CollectionFiltersProvider';
import { useTheme } from '../../../../theme';

export default function CollectionLayout() {
  const theme = useTheme();

  return (
    <CollectionFiltersProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontFamily: theme.fonts.semiBold },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Collection' }} />
        <Stack.Screen name="filters" options={{ title: 'Filtres', presentation: 'modal' }} />
      </Stack>
    </CollectionFiltersProvider>
  );
}
