export type HouseholdGate = 'loading' | 'error' | 'empty' | 'select' | 'ready';

export interface HouseholdGateInput {
  /** Une réponse de /households a été reçue (même vide). */
  hasData: boolean;
  isError: boolean;
  householdCount: number;
  householdId: string | null;
}

/**
 * Quel écran afficher avant l'app (Release 0B). Règle « données d'abord », comme ailleurs :
 *
 * - données reçues → on les utilise, même si un rafraîchissement ultérieur échoue ;
 * - aucune donnée + erreur → écran d'erreur avec « Réessayer » ;
 * - aucune donnée sinon → chargement.
 *
 * « Aucun foyer » (créer son nid) n'est affiché QUE sur une réponse valide et vide : une
 * erreur réseau ne doit jamais inviter quelqu'un qui a déjà un foyer à en créer un second.
 */
export function resolveHouseholdGate({
  hasData,
  isError,
  householdCount,
  householdId,
}: HouseholdGateInput): HouseholdGate {
  if (hasData) {
    if (householdCount === 0) return 'empty';
    return householdId ? 'ready' : 'select';
  }
  return isError ? 'error' : 'loading';
}
