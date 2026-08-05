import * as SecureStore from 'expo-secure-store';

const LAST_HOUSEHOLD_KEY = 'notre-nid.lastHouseholdId';

/**
 * Mémorise le dernier household consulté (docs/NOTRE_NID_PRD.md section 9,
 * « Sélection du household »). Pas une donnée sensible, mais SecureStore est
 * réutilisé plutôt que d'ajouter AsyncStorage comme dépendance supplémentaire.
 */
export async function getLastHouseholdId(): Promise<string | null> {
  return SecureStore.getItemAsync(LAST_HOUSEHOLD_KEY);
}

export async function setLastHouseholdId(householdId: string): Promise<void> {
  await SecureStore.setItemAsync(LAST_HOUSEHOLD_KEY, householdId);
}

export async function clearLastHouseholdId(): Promise<void> {
  await SecureStore.deleteItemAsync(LAST_HOUSEHOLD_KEY);
}
