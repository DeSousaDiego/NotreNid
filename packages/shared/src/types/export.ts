import type { BookMetadata, CdMetadata, DvdMetadata, ItemCondition } from './item';

/** Forme exacte d'un élément renvoyé par `GET /households/:householdId/exports/json`. */
export interface HouseholdExportItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  condition: ItemCondition;
  owners: string[];
  archived: boolean;
  createdAt: string;
  notes: string | null;
  book: BookMetadata | null;
  cd: CdMetadata | null;
  dvd: DvdMetadata | null;
}
