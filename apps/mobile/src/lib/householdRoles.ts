import type { HouseholdRole } from '@notre-nid/shared';

/**
 * Vocabulaire humain des rôles d'un foyer — jamais "propriétaire" ni
 * "administrateur" à l'écran (termes d'outil de gestion). La valeur technique
 * (`OWNER`/`ADMIN`/`MEMBER`) reste celle de l'API.
 */
const ROLE_LABELS: Record<HouseholdRole, string> = {
  OWNER: 'Responsable du foyer',
  ADMIN: 'Peut gérer le foyer',
  MEMBER: 'Membre du foyer',
};

export function householdRoleLabel(role: HouseholdRole): string {
  return ROLE_LABELS[role];
}

/** Options du choix de rôle (fiche d'un membre), dans l'ordre d'affichage. */
export const HOUSEHOLD_ROLE_OPTIONS: readonly {
  value: HouseholdRole;
  label: string;
  description: string;
}[] = [
  {
    value: 'OWNER',
    label: ROLE_LABELS.OWNER,
    description: 'Veille sur le foyer, ses membres et ses invitations.',
  },
  {
    value: 'ADMIN',
    label: ROLE_LABELS.ADMIN,
    description: 'Peut inviter et accompagner les membres.',
  },
  {
    value: 'MEMBER',
    label: ROLE_LABELS.MEMBER,
    description: 'Consulte et enrichit la collection.',
  },
];

/** « Vous êtes 2 dans ce nid » — une seule personne : formulation neutre, sans accord. */
export function householdHeadcountLabel(count: number): string {
  if (count <= 1) return 'Pour l’instant, ce nid n’accueille que vous';
  return `Vous êtes ${count} dans ce nid`;
}
