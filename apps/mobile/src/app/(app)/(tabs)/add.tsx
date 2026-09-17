import { router } from 'expo-router';
import { useEffect } from 'react';

/**
 * Ne devrait normalement jamais se monter : `(tabs)/_layout.tsx` intercepte la
 * pression sur cet onglet (`listeners.tabPress`, voir `useAddTabPress`) et navigue
 * directement vers le flow d'ajout sans jamais activer cet écran.
 *
 * Auparavant, cet écran rendait `<Redirect href="/(app)/add-item/category" />` — mais
 * `<Redirect>` s'abonne via `useFocusEffect` (voir expo-router/build/link/Redirect.js) :
 * il rappelle `router.replace()` à CHAQUE focus, pas seulement au premier montage. Les
 * onglets ne démontent jamais leur contenu par défaut, donc cet onglet restait monté en
 * arrière-plan et reprenait le focus (donc redéclenchait le replace) à chaque nouvelle
 * pression — or `add-item` est un écran frère de `(tabs)` (pas une route interne aux
 * onglets), donc ce `replace` remontait au Stack racine et remplaçait tout le
 * navigateur d'onglets. Résultat observé en test manuel Android : écran noir puis
 * crash, y compris après avoir quitté le flow et rouvert l'onglet.
 *
 * Ce composant reste un filet de sécurité pour un lien profond direct vers `/add`
 * (hors interaction normale avec la tab bar) : `router.replace` n'y tourne qu'une
 * seule fois au montage (`useEffect`, pas `useFocusEffect`), jamais à chaque focus.
 */
export default function AddItemTabFallback() {
  useEffect(() => {
    // Si ce log apparaît pendant un test manuel où l'onglet a été pressé normalement
    // (pas un lien profond), l'interception `tabPress` n'a pas fonctionné — signal fort
    // à investiguer en priorité.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[tabs/add] mounted — should only happen via a direct deep link to /add');
    }
    router.replace('/(app)/add-item/category');
  }, []);

  return null;
}
