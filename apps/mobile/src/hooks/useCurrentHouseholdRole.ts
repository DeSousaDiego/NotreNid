import type { HouseholdRole } from '@notre-nid/shared';

import { useHousehold } from '../providers/HouseholdProvider';

export interface CurrentHouseholdRole {
  role: HouseholdRole | undefined;
  /** OWNER ou ADMIN : peut gérer les membres et les invitations (docs/NOTRE_NID_PRD.md section 6). */
  isAdmin: boolean;
  isOwner: boolean;
}

/**
 * Rôle de l'utilisateur courant dans le foyer sélectionné. Purement indicatif pour
 * l'affichage : l'API revérifie toujours l'appartenance et le rôle.
 */
export function useCurrentHouseholdRole(): CurrentHouseholdRole {
  const { householdId, households } = useHousehold();
  const role = households.find((h) => h.id === householdId)?.role;
  return { role, isAdmin: role === 'OWNER' || role === 'ADMIN', isOwner: role === 'OWNER' };
}
