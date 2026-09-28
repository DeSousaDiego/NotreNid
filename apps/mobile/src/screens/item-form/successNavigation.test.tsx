import { router, Stack, Tabs } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Pressable, Text } from 'react-native';

import { leaveAddFlowToCollection } from './successNavigation';

/**
 * Même topologie que `src/app` (vrai routeur Expo Router, vraie native stack sous
 * Jest) : Stack racine → `(app)` Stack → `(tabs)` Tabs (dont `collection` en Stack)
 * + `add-item` Stack frère des onglets. Ne prouve PAS le rendu natif (la validation
 * finale reste le téléphone) — prouve la pile de navigation obtenue.
 */
const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  '(auth)/login': () => <Text>LOGIN</Text>,
  '(app)/_layout': () => <Stack />,
  '(app)/(tabs)/_layout': () => <Tabs />,
  '(app)/(tabs)/index': () => (
    <Pressable onPress={() => router.push('/(app)/add-item/category')}>
      <Text>HOME</Text>
    </Pressable>
  ),
  '(app)/(tabs)/collection/_layout': () => <Stack />,
  '(app)/(tabs)/collection/index': () => <Text>COLLECTION</Text>,
  '(app)/add-item/_layout': () => <Stack />,
  '(app)/add-item/category': () => (
    <Pressable onPress={() => router.push('/(app)/add-item/form')}>
      <Text>CATEGORY</Text>
    </Pressable>
  ),
  '(app)/add-item/form': () => (
    <>
      <Pressable onPress={leaveAddFlowToCollection}>
        <Text>CREATED</Text>
      </Pressable>
      <Pressable onPress={() => router.replace('/collection')}>
        <Text>CREATED_WITH_REPLACE</Text>
      </Pressable>
    </>
  ),
};

interface RouteState {
  index: number;
  routes: { name: string; state?: RouteState }[];
}

function appStack(state: RouteState | undefined): RouteState {
  // État du conteneur : `__root` (layout racine) → `(app)`.
  const root = state?.routes.find((route) => route.name === '__root')?.state ?? state;
  const app = root?.routes.find((route) => route.name === '(app)')?.state;
  if (!app) throw new Error('(app) stack not found');
  return app;
}

async function settle() {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function openCreateForm() {
  const view = renderRouter(routes, { initialUrl: '/' });
  // Avec @testing-library/react-native 14, `render` est asynchrone : Expo Router
  // attache ses helpers (`getPathname`, `getRouterState`…) à l'objet retourné,
  // qu'il faut attendre avant la première interaction.
  await (view as unknown as Promise<unknown>);
  await settle();
  await act(async () => {
    void fireEvent.press(screen.getByText('HOME'));
  });
  await settle();
  await act(async () => {
    void fireEvent.press(screen.getByText('CATEGORY'));
  });
  await settle();
  expect(appStack(view.getRouterState() as RouteState).routes.map((r) => r.name)).toEqual([
    '(tabs)',
    'add-item',
  ]);
  // Enveloppé : retourner `view` tel quel depuis une fonction async « adopterait »
  // le thenable et perdrait ses helpers Expo Router.
  return { view };
}

describe('leaveAddFlowToCollection (topologie réelle des routes)', () => {
  it('leaves the add-item flow back to the EXISTING tabs instance, Collection tab focused', async () => {
    const { view } = await openCreateForm();

    await act(async () => {
      void fireEvent.press(screen.getByText('CREATED'));
    });
    await settle();

    expect(view.getPathname()).toBe('/collection');
    expect(screen.getByText('COLLECTION')).toBeTruthy();
    const app = appStack(view.getRouterState() as RouteState);
    // Une seule instance d'onglets, plus aucun flow d'ajout dans la pile.
    expect(app.routes.map((r) => r.name)).toEqual(['(tabs)']);
    const tabs = app.routes[0]!.state!;
    expect(tabs.routes[tabs.index]!.name).toBe('collection');
  });

  it('control — `router.replace` stacks a SECOND tabs instance over the first (cause of the black screen)', async () => {
    const { view } = await openCreateForm();

    await act(async () => {
      void fireEvent.press(screen.getByText('CREATED_WITH_REPLACE'));
    });
    await settle();

    expect(appStack(view.getRouterState() as RouteState).routes.map((r) => r.name)).toEqual([
      '(tabs)',
      '(tabs)',
    ]);
  });
});
