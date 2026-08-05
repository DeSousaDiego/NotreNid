import type { ItemCondition } from '@notre-nid/shared';

import type { ColorToken } from '../theme';

/** Libellés français + couleur d'accent (jamais la seule indication d'état — le texte est toujours affiché). */
export const CONDITION_INFO: Record<ItemCondition, { label: string; color: ColorToken }> = {
  NEW: { label: 'Neuf', color: 'primary' },
  VERY_GOOD: { label: 'Très bon état', color: 'primaryMuted' },
  GOOD: { label: 'Bon état', color: 'accent' },
  FAIR: { label: 'État correct', color: 'secondary' },
  POOR: { label: 'État moyen', color: 'danger' },
};
