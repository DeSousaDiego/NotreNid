/**
 * Double de test de `usePreventRemove` (`expo-router/react-navigation`) pour les
 * écrans rendus hors navigateur réel. Mémorise, à chaque rendu, la valeur de garde
 * et le callback les plus récents — exactement ce que lit le vrai hook au moment
 * d'un retour arrière — et permet de simuler ce retour (bouton système Android,
 * bouton retour du header, geste iOS) sans navigation réelle.
 *
 * Usage dans un fichier de test :
 *   jest.mock('expo-router/react-navigation', () => ({
 *     usePreventRemove: (...args) =>
 *       require('../../test-utils/preventRemoveMock').recordPreventRemove(...args),
 *   }));
 */
type PreventRemoveCallback = (options: { data: { action: unknown } }) => void;

const state: { enabled: boolean; callback: PreventRemoveCallback | null } = {
  enabled: false,
  callback: null,
};

export function recordPreventRemove(enabled: boolean, callback: PreventRemoveCallback): void {
  state.enabled = enabled;
  state.callback = callback;
}

export const GO_BACK_ACTION = { type: 'GO_BACK' } as const;

/**
 * Simule une tentative de retour. Renvoie `true` si la garde l'a interceptée
 * (l'écran reste affiché, le callback a reçu l'action), `false` si la navigation
 * aurait eu lieu normalement.
 */
export function simulateBackAttempt(action: unknown = GO_BACK_ACTION): boolean {
  if (!state.enabled || !state.callback) return false;
  state.callback({ data: { action } });
  return true;
}

export function isRemovalGuarded(): boolean {
  return state.enabled;
}

export function resetPreventRemoveMock(): void {
  state.enabled = false;
  state.callback = null;
}
