import type { PublicUser } from './user';

/** Forme exacte renvoyée par `StatsService.getStats` (apps/api/src/stats/stats.service.ts). */
export interface HouseholdStats {
  totalActiveItems: number;
  archivedCount: number;
  countByCategory: Array<{
    categoryId: string;
    categoryName: string;
    categorySlug: string;
    count: number;
  }>;
  countByOwner: Array<{ user: PublicUser; count: number }>;
  recentAdditions: Array<{ id: string; title: string; category: string; createdAt: string }>;
}
