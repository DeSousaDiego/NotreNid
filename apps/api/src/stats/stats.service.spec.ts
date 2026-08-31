import { StatsService } from './stats.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('StatsService', () => {
  let prisma: {
    item: { count: jest.Mock; findMany: jest.Mock; groupBy: jest.Mock };
    itemOwner: { findMany: jest.Mock };
    category: { findMany: jest.Mock };
  };
  let service: StatsService;

  beforeEach(() => {
    prisma = {
      item: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
      itemOwner: { findMany: jest.fn() },
      category: { findMany: jest.fn() },
    };
    service = new StatsService(prisma as unknown as PrismaService);
  });

  it('includes the category slug alongside each per-category count', async () => {
    prisma.item.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    prisma.item.groupBy.mockResolvedValue([
      { categoryId: 'cat-book', _count: { _all: 2 } },
      { categoryId: 'cat-cd', _count: { _all: 1 } },
    ]);
    prisma.item.findMany.mockResolvedValue([]);
    prisma.itemOwner.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([
      { id: 'cat-book', name: 'Livres', slug: 'book' },
      { id: 'cat-cd', name: 'CD', slug: 'cd' },
    ]);

    const stats = await service.getStats('household-1');

    expect(stats.countByCategory).toEqual([
      { categoryId: 'cat-book', categoryName: 'Livres', categorySlug: 'book', count: 2 },
      { categoryId: 'cat-cd', categoryName: 'CD', categorySlug: 'cd', count: 1 },
    ]);
  });
});
