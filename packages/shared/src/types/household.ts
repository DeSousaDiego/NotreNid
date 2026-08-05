import type { PublicUser } from './user';

export const HOUSEHOLD_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export type HouseholdRole = (typeof HOUSEHOLD_ROLES)[number];

export interface Household {
  id: string;
  name: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

/** Renvoyé par `GET /households` (liste des households de l'utilisateur courant). */
export interface HouseholdWithRole extends Household {
  role: HouseholdRole;
}

/** Renvoyé par `GET /households/:householdId/members`. */
export interface HouseholdMember {
  id: string;
  role: HouseholdRole;
  joinedAt: string;
  user: PublicUser;
}
