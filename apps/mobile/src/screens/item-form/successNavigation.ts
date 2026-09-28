import { router } from 'expo-router';

/**
 * Sortie du flow d'ajout après une création réussie, vers l'onglet Collection.
 *
 * `dismissTo` (jamais `replace`) : le flow `add-item` est un écran frère de
 * `(tabs)` dans la Stack `(app)`. `router.replace('/collection')` y remplaçait
 * `add-item` par une NOUVELLE instance de `(tabs)`, empilée au-dessus de
 * l'instance existante — deux navigateurs d'onglets dans la même pile (écran noir
 * constaté sur appareil après « Ajouter au nid »). `dismissTo` dépile `add-item`
 * jusqu'à l'instance `(tabs)` déjà présente et y active l'onglet Collection :
 * une seule instance d'onglets, pile identique à celle d'avant l'ouverture du flow.
 * Vérifié sur la topologie réelle des routes : `successNavigation.test.tsx`.
 */
export function leaveAddFlowToCollection(): void {
  router.dismissTo('/collection');
}
