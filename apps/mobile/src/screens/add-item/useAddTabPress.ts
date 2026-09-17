import { router } from 'expo-router';
import { useCallback, useRef } from 'react';

const REPEAT_GUARD_MS = 800;

export interface TabPressEvent {
  preventDefault: () => void;
}

/**
 * Gère la pression sur l'onglet « Ajouter ». Toujours `preventDefault()` — l'onglet ne
 * doit jamais réellement être activé/focalisé par le navigateur d'onglets (voir
 * `(tabs)/_layout.tsx` et `(tabs)/add.tsx` pour le contexte complet : l'ancien
 * `<Redirect>` monté comme contenu de cet onglet se réabonnait à CHAQUE focus via son
 * `useFocusEffect` interne, et son `router.replace` vers une route hors de `(tabs)`
 * remplaçait tout le navigateur d'onglets — cause du crash/écran noir constaté en test
 * manuel). `router.push` part donc toujours de l'écran réellement affiché, sans jamais
 * démonter `(tabs)`.
 *
 * Le garde-fou temporel évite qu'un double-tap rapide (avant que la tab bar ne
 * disparaisse) n'empile deux instances du flow sur la pile racine.
 */
export function useAddTabPress(): (event: TabPressEvent) => void {
  // `-Infinity`, pas `0` : garantit que la toute première pression passe toujours,
  // quelle que soit la valeur réelle de `Date.now()` à cet instant (ex. `0` en test).
  const lastPressAtRef = useRef(-Infinity);

  return useCallback((event: TabPressEvent) => {
    event.preventDefault();
    const now = Date.now();
    if (now - lastPressAtRef.current < REPEAT_GUARD_MS) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[useAddTabPress] repeat press ignored (debounce window)');
      }
      return;
    }
    lastPressAtRef.current = now;
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[useAddTabPress] navigating to /(app)/add-item/category');
    }
    router.push('/(app)/add-item/category');
  }, []);
}
