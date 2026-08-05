export const CATEGORY_FIELD_TYPES = ['string', 'number', 'boolean'] as const;
export type CategoryFieldType = (typeof CATEGORY_FIELD_TYPES)[number];

export interface CategoryFieldSchema {
  key: string;
  label: string;
  type: CategoryFieldType;
  required?: boolean;
}

export interface Category {
  id: string;
  householdId: string | null;
  name: string;
  slug: string;
  icon: string | null;
  isSystem: boolean;
  metadataSchema: CategoryFieldSchema[] | null;
  createdAt: string;
  updatedAt: string;
}

/** Slugs stables des catégories système, créées par le seed (voir apps/api/prisma/seed.ts). */
export const SYSTEM_CATEGORY_SLUGS = {
  BOOK: 'book',
  CD: 'cd',
  DVD: 'dvd',
} as const;
