import { ItemCondition } from '@prisma/client';

import { ItemsService } from './items.service';
import type { CategoriesService } from '../categories/categories.service';
import type { AppException } from '../common/exceptions/app-exception';
import type { PrismaService } from '../prisma/prisma.service';

describe('ItemsService', () => {
  let prisma: {
    category: { findUnique: jest.Mock };
    householdMember: { findMany: jest.Mock };
    item: { findUnique: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let categoriesService: { validateCustomMetadata: jest.Mock };
  let service: ItemsService;

  beforeEach(() => {
    prisma = {
      category: { findUnique: jest.fn() },
      householdMember: { findMany: jest.fn() },
      item: { findUnique: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(),
    };
    categoriesService = { validateCustomMetadata: jest.fn() };
    service = new ItemsService(
      prisma as unknown as PrismaService,
      categoriesService as unknown as CategoriesService,
    );
  });

  describe('create — ownership validation', () => {
    it('rejects an ownerId that is not a member of the household', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat1',
        householdId: null,
        isSystem: true,
        metadataSchema: null,
      });
      prisma.householdMember.findMany.mockResolvedValue([{ userId: 'member-1' }]);

      await expect(
        service.create('h1', 'member-1', {
          categoryId: 'cat1',
          title: 'Test',
          condition: ItemCondition.GOOD,
          ownerIds: ['member-1', 'stranger'],
        }),
      ).rejects.toMatchObject<Partial<AppException>>({ code: 'OWNERS_NOT_MEMBERS' });

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('create — rating', () => {
    it('passes the rating through to Prisma when provided', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat1',
        householdId: null,
        isSystem: true,
        metadataSchema: null,
      });
      prisma.householdMember.findMany.mockResolvedValue([{ userId: 'member-1' }]);
      const fakeUser = {
        id: 'member-1',
        email: 'a@a.com',
        displayName: 'A',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordHash: 'x',
      };
      const txItem = {
        id: 'item1',
        householdId: 'h1',
        title: 'Dune',
        description: null,
        condition: ItemCondition.GOOD,
        rating: 3.5,
        coverImageUrl: null,
        notes: null,
        customMetadata: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat1' },
        owners: [],
        bookMetadata: null,
        cdMetadata: null,
        dvdMetadata: null,
        createdBy: fakeUser,
        updatedBy: fakeUser,
      };
      const itemCreate = jest.fn().mockResolvedValue(txItem);
      const auditLogCreate = jest.fn().mockResolvedValue({});
      prisma.$transaction.mockImplementation(
        async (
          fn: (tx: {
            item: { create: typeof itemCreate };
            auditLog: { create: typeof auditLogCreate };
          }) => unknown,
        ) => fn({ item: { create: itemCreate }, auditLog: { create: auditLogCreate } }),
      );

      const result = await service.create('h1', 'member-1', {
        categoryId: 'cat1',
        title: 'Dune',
        condition: ItemCondition.GOOD,
        rating: 3.5,
        ownerIds: ['member-1'],
      });

      expect(itemCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ rating: 3.5 }) }),
      );
      expect(result.rating).toBe(3.5);
    });

    it('keeps the existing rating on update when none is provided in the patch', async () => {
      const existing = {
        id: 'item1',
        householdId: 'h1',
        categoryId: 'cat1',
        title: 'Dune',
        description: null,
        condition: ItemCondition.GOOD,
        rating: 4,
        notes: null,
        coverImageUrl: null,
        customMetadata: null,
        archivedAt: null,
        owners: [],
      };
      prisma.item.findUnique.mockResolvedValue(existing);
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat1',
        householdId: null,
        isSystem: true,
        metadataSchema: null,
      });
      const fakeUser = {
        id: 'u1',
        email: 'a@a.com',
        displayName: 'A',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordHash: 'x',
      };
      const updated = {
        ...existing,
        category: { id: 'cat1' },
        bookMetadata: null,
        cdMetadata: null,
        dvdMetadata: null,
        createdBy: fakeUser,
        updatedBy: fakeUser,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const itemUpdate = jest.fn().mockResolvedValue(updated);
      const auditLogCreate = jest.fn().mockResolvedValue({});
      prisma.$transaction.mockImplementation(
        async (
          fn: (tx: {
            item: { update: typeof itemUpdate };
            auditLog: { create: typeof auditLogCreate };
          }) => unknown,
        ) => fn({ item: { update: itemUpdate }, auditLog: { create: auditLogCreate } }),
      );

      const result = await service.update('h1', 'item1', 'u1', {
        title: 'Dune (nouvelle édition)',
      });

      expect(itemUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ rating: 4 }) }),
      );
      expect(result.rating).toBe(4);
    });
  });

  describe('household isolation', () => {
    it('treats an item from another household as not found', async () => {
      prisma.item.findUnique.mockResolvedValue({ id: 'item1', householdId: 'other-household' });

      await expect(service.findOne('h1', 'item1')).rejects.toMatchObject<Partial<AppException>>({
        code: 'NOT_FOUND',
      });
    });

    it('returns the item when it belongs to the requested household', async () => {
      const item = {
        id: 'item1',
        householdId: 'h1',
        title: 'Ok',
        description: null,
        condition: ItemCondition.GOOD,
        coverImageUrl: null,
        notes: null,
        customMetadata: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat1' },
        owners: [],
        bookMetadata: null,
        cdMetadata: null,
        dvdMetadata: null,
        createdBy: {
          id: 'u1',
          email: 'a@a.com',
          displayName: 'A',
          avatarUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          passwordHash: 'x',
        },
        updatedBy: {
          id: 'u1',
          email: 'a@a.com',
          displayName: 'A',
          avatarUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          passwordHash: 'x',
        },
      };
      prisma.item.findUnique.mockResolvedValue(item);

      const result = await service.findOne('h1', 'item1');
      expect(result.id).toBe('item1');
    });
  });

  describe('archive', () => {
    it('refuses to archive an item that is already archived', async () => {
      prisma.item.findUnique.mockResolvedValue({
        id: 'item1',
        householdId: 'h1',
        archivedAt: new Date(),
      });

      await expect(service.archive('h1', 'item1', 'u1')).rejects.toMatchObject<
        Partial<AppException>
      >({
        code: 'ITEM_ALREADY_ARCHIVED',
      });
    });
  });
});
