import type { Category } from './category';
import type { PublicUser } from './user';

export const ITEM_CONDITIONS = ['NEW', 'VERY_GOOD', 'GOOD', 'FAIR', 'POOR'] as const;
export type ItemCondition = (typeof ITEM_CONDITIONS)[number];

/** Notes autorisées pour `Item.rating` : demi-étoiles de 0,5 à 5. `null`/absent = pas de note. */
export const ITEM_RATING_VALUES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;
export type ItemRating = (typeof ITEM_RATING_VALUES)[number];

export interface BookMetadata {
  itemId: string;
  author: string | null;
  isbn: string | null;
  publisher: string | null;
  publicationYear: number | null;
  language: string | null;
  pageCount: number | null;
}

export interface CdMetadata {
  itemId: string;
  artist: string | null;
  album: string | null;
  releaseYear: number | null;
  label: string | null;
  format: string | null;
}

export interface DvdMetadata {
  itemId: string;
  director: string | null;
  releaseYear: number | null;
  edition: string | null;
  region: string | null;
  format: string | null;
  durationMinutes: number | null;
}

/** Forme exacte renvoyée par `ItemsService.toResponse` (apps/api/src/items/items.service.ts). */
export interface Item {
  id: string;
  householdId: string;
  title: string;
  description: string | null;
  condition: ItemCondition;
  rating: ItemRating | null;
  coverImageUrl: string | null;
  notes: string | null;
  customMetadata: Record<string, unknown> | null;
  /** Codes ISO 3166-1 alpha-2, triés. Tableau vide = aucun pays renseigné. */
  countryCodes: string[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: Category;
  owners: PublicUser[];
  book: BookMetadata | null;
  cd: CdMetadata | null;
  dvd: DvdMetadata | null;
  createdBy: PublicUser;
  updatedBy: PublicUser;
}

export const ITEM_SORT_FIELDS = ['title', 'createdAt', 'updatedAt', 'condition'] as const;
export type ItemSortField = (typeof ITEM_SORT_FIELDS)[number];

/** Paramètres de requête acceptés par `GET /households/:householdId/items`. */
export interface ItemsQueryParams {
  search?: string;
  categoryId?: string;
  ownerId?: string;
  condition?: ItemCondition;
  archived?: boolean;
  createdById?: string;
  sort?: ItemSortField;
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}
