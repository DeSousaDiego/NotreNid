import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { AddItemDraftProvider } from '../../../screens/add-item/AddItemDraftContext';
import { useTheme } from '../../../theme';

/**
 * Stack imbriqué du flow d'ajout (Bloc 2) : même mécanisme que `(tabs)` sous
 * `(app)/_layout.tsx` — un `Stack.Screen name="add-item"` unique y est enregistré,
 * et chaque écran ci-dessous masque donc naturellement la tab bar en héritant de ce
 * sous-arbre, sans jamais être un descendant de `<Tabs>`.
 *
 * `AddItemDraftProvider` vit ici (pas plus haut) : il survit à la navigation entre
 * catégorie/mode/scan/formulaire (retour arrière compris), mais se démonte — et donc
 * oublie le brouillon — dès qu'on quitte tout le flow, ce qui est le comportement
 * voulu pour cette version (pas de persistance disque, voir docs/DECISIONS.md).
 */
export default function AddItemLayout() {
  const theme = useTheme();

  // Aide au diagnostic (voir docs/DECISIONS.md — Bloc 2, crash/écran noir constaté en
  // test manuel Android) : confirme en test manuel qu'une seule instance de ce Stack
  // (et donc du brouillon) existe à la fois, et qu'elle est bien démontée en quittant
  // le flow — jamais plusieurs montages empilés ni de fuite d'une session à l'autre.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[add-item/_layout] mounted (fresh draft)');
    }
    return () => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[add-item/_layout] unmounted (draft discarded)');
      }
    };
  }, []);

  return (
    <AddItemDraftProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontFamily: theme.fonts.semiBold },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="category" options={{ title: '' }} />
        <Stack.Screen name="mode" options={{ title: '' }} />
        <Stack.Screen name="scan" options={{ title: '' }} />
        <Stack.Screen name="form" options={{ title: '' }} />
      </Stack>
    </AddItemDraftProvider>
  );
}
