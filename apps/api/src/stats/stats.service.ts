import { Injectable } from '@nestjs/common';

import { toPublicUser } from '../common/mappers/public-user.mapper';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(householdId: string) {
    const [totalActiveItems, archivedCount, byCategory, recentItems, ownerRows] = await Promise.all(
      [
        this.prisma.item.count({ where: { householdId, archivedAt: null } }),
        this.prisma.item.count({ where: { householdId, archivedAt: { not: null } } }),
        this.prisma.item.groupBy({
          by: ['categoryId'],
          where: { householdId, archivedAt: null },
          _count: { _all: true },
        }),
        this.prisma.item.findMany({
          where: { householdId, archivedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { category: true },
        }),
        this.prisma.itemOwner.findMany({
          where: { item: { householdId, archivedAt: null } },
          include: { user: true },
        }),
      ],
    );

    const categories = await this.prisma.category.findMany({
      where: { id: { in: byCategory.map((c) => c.categoryId) } },
    });
    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
    const categorySlugById = new Map(categories.map((c) => [c.id, c.slug]));

    const countByOwner = new Map<
      string,
      { user: ReturnType<typeof toPublicUser>; count: number }
    >();
    for (const row of ownerRows) {
      const existing = countByOwner.get(row.userId);
      if (existing) {
        existing.count += 1;
      } else {
        countByOwner.set(row.userId, { user: toPublicUser(row.user), count: 1 });
      }
    }

    return {
      totalActiveItems,
      archivedCount,
      countByCategory: byCategory.map((c) => ({
        categoryId: c.categoryId,
        categoryName: categoryNameById.get(c.categoryId) ?? 'Inconnue',
        categorySlug: categorySlugById.get(c.categoryId) ?? '',
        count: c._count._all,
      })),
      countByOwner: Array.from(countByOwner.values()),
      recentAdditions: recentItems.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category.name,
        createdAt: item.createdAt,
      })),
    };
  }
}
