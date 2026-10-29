import type { ItemSortField } from '@notre-nid/shared';

export interface CollectionSortPreset {
  key: string;
  label: string;
  sort: ItemSortField;
  order: 'asc' | 'desc';
}

/**
 * Tris proposés dans l'écran Filtres : chaque libellé humain correspond à un couple
 * `sort`/`order` déjà accepté par l'API (rien de nouveau côté serveur). Remplace
 * l'ancien « Trier par » + « Croissant / Décroissant ». L'état est trié selon l'ordre
 * de l'enum `ItemCondition` (NEW → POOR) : `asc` = meilleur état d'abord.
 */
export const COLLECTION_SORT_PRESETS: readonly CollectionSortPreset[] = [
  { key: 'newest', label: 'Plus récents', sort: 'createdAt', order: 'desc' },
  { key: 'oldest', label: 'Plus anciens', sort: 'createdAt', order: 'asc' },
  { key: 'title-asc', label: 'Titre A → Z', sort: 'title', order: 'asc' },
  { key: 'title-desc', label: 'Titre Z → A', sort: 'title', order: 'desc' },
  { key: 'updated', label: 'Récemment modifiés', sort: 'updatedAt', order: 'desc' },
  { key: 'best-condition', label: 'Meilleur état d’abord', sort: 'condition', order: 'asc' },
];

export function isSortPresetSelected(
  preset: CollectionSortPreset,
  value: { sort: ItemSortField; order: 'asc' | 'desc' },
): boolean {
  return preset.sort === value.sort && preset.order === value.order;
}
