import { Prisma } from '@prisma/client';

import { CategoriesService } from './categories.service';
import type { AppException } from '../common/exceptions/app-exception';
import type { PrismaService } from '../prisma/prisma.service';

function foreignKeyError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Foreign key constraint violated', {
    code: 'P2003',
    clientVersion: 'test',
  });
}

describe('CategoriesService', () => {
  let prisma: {
    category: {
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
    item: {
      count: jest.Mock;
    };
  };
  let service: CategoriesService;

  beforeEach(() => {
    prisma = {
      category: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
      item: { count: jest.fn() },
    };
    service = new CategoriesService(prisma as unknown as PrismaService);
  });

  describe('remove', () => {
    it('deletes a custom category owned by the household with no items left', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        householdId: 'h1',
        isSystem: false,
      });
      prisma.item.count.mockResolvedValue(0);
      prisma.category.delete.mockResolvedValue({});

      await service.remove('h1', 'cat-1');
      expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
    });

    it('refuses to delete a category still referenced by items, with a friendly error', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        householdId: 'h1',
        isSystem: false,
      });
      prisma.item.count.mockResolvedValue(2);

      await expect(service.remove('h1', 'cat-1')).rejects.toMatchObject<Partial<AppException>>({
        code: 'CATEGORY_IN_USE',
      });
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    it('falls back to a friendly error if delete() itself hits a foreign key constraint (race with a concurrent item creation)', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        householdId: 'h1',
        isSystem: false,
      });
      prisma.item.count.mockResolvedValue(0);
      prisma.category.delete.mockRejectedValue(foreignKeyError());

      await expect(service.remove('h1', 'cat-1')).rejects.toMatchObject<Partial<AppException>>({
        code: 'CATEGORY_IN_USE',
      });
    });

    it('falls back to a friendly error even when the driver error lacks a Prisma error code', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        householdId: 'h1',
        isSystem: false,
      });
      prisma.item.count.mockResolvedValue(0);
      prisma.category.delete.mockRejectedValue(
        new Error('Foreign key constraint violated on the constraint: `items_categoryId_fkey`'),
      );

      await expect(service.remove('h1', 'cat-1')).rejects.toMatchObject<Partial<AppException>>({
        code: 'CATEGORY_IN_USE',
      });
    });

    it('refuses to delete a system category', async () => {
      // Les catégories système ont toujours householdId=null en pratique ; on
      // fixe householdId='h1' ici uniquement pour isoler la vérification
      // isSystem de celle d'appartenance au household (couverte séparément
      // ci-dessous).
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-book',
        householdId: 'h1',
        isSystem: true,
      });

      await expect(service.remove('h1', 'cat-book')).rejects.toMatchObject<Partial<AppException>>({
        code: 'SYSTEM_CATEGORY_READONLY',
      });
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    it('refuses to delete a category belonging to another household', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        householdId: 'h2',
        isSystem: false,
      });

      await expect(service.remove('h1', 'cat-1')).rejects.toMatchObject<Partial<AppException>>({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('create', () => {
    it('rejects a duplicate category name for the same household with a friendly error', async () => {
      prisma.category.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.create('h1', { name: 'Vinyles' })).rejects.toMatchObject<
        Partial<AppException>
      >({ code: 'CATEGORY_ALREADY_EXISTS' });
    });
  });
});
