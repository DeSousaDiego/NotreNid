import { SetMetadata } from '@nestjs/common';
import type { HouseholdRole } from '@prisma/client';

export const HOUSEHOLD_ROLES_KEY = 'householdRoles';

/**
 * Restreint une route de household aux rôles listés. Doit être combiné avec
 * `HouseholdMembershipGuard`, qui charge l'appartenance et vérifie ce
 * métadonnée. Sans ce décorateur, tout membre (quel que soit son rôle) est autorisé.
 */
export const HouseholdRoles = (...roles: HouseholdRole[]) =>
  SetMetadata(HOUSEHOLD_ROLES_KEY, roles);
