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
        countries: [],
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
        countries: [],
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

  describe('create — barcode', () => {
    it('passes the barcode through to Prisma when provided', async () => {
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
        title: 'Discovery',
        barcode: '3600029412578',
        description: null,
        condition: ItemCondition.GOOD,
        rating: null,
        coverImageUrl: null,
        notes: null,
        customMetadata: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat1' },
        owners: [],
        countries: [],
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
        title: 'Discovery',
        barcode: '3600029412578',
        condition: ItemCondition.GOOD,
        ownerIds: ['member-1'],
      });

      expect(itemCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ barcode: '3600029412578' }) }),
      );
      expect(result.barcode).toBe('3600029412578');
    });

    it('leaves the barcode absent (null) when none is provided', async () => {
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
        barcode: null,
        description: null,
        condition: ItemCondition.GOOD,
        rating: null,
        coverImageUrl: null,
        notes: null,
        customMetadata: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat1' },
        owners: [],
        countries: [],
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
        ownerIds: ['member-1'],
      });

      expect(itemCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ barcode: undefined }) }),
      );
      expect(result.barcode).toBeNull();
    });

    it('keeps the existing barcode on update when none is provided in the patch', async () => {
      const existing = {
        id: 'item1',
        householdId: 'h1',
        categoryId: 'cat1',
        title: 'Dune',
        barcode: '3600029412578',
        description: null,
        condition: ItemCondition.GOOD,
        rating: null,
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
        countries: [],
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
        expect.objectContaining({ data: expect.objectContaining({ barcode: '3600029412578' }) }),
      );
      expect(result.barcode).toBe('3600029412578');
    });

    it('updates the barcode when provided in the patch', async () => {
      const existing = {
        id: 'item1',
        householdId: 'h1',
        categoryId: 'cat1',
        title: 'Dune',
        barcode: null,
        description: null,
        condition: ItemCondition.GOOD,
        rating: null,
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
        barcode: '9781234567897',
        category: { id: 'cat1' },
        countries: [],
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

      const result = await service.update('h1', 'item1', 'u1', { barcode: '9781234567897' });

      expect(itemUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ barcode: '9781234567897' }) }),
      );
      expect(result.barcode).toBe('9781234567897');
    });

    it('clears the barcode when the patch explicitly sets it to null (distinct from omitting it)', async () => {
      const existing = {
        id: 'item1',
        householdId: 'h1',
        categoryId: 'cat1',
        title: 'Dune',
        barcode: '3600029412578',
        description: null,
        condition: ItemCondition.GOOD,
        rating: null,
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
        barcode: null,
        category: { id: 'cat1' },
        countries: [],
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

      const result = await service.update('h1', 'item1', 'u1', { barcode: null });

      expect(itemUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ barcode: null }) }),
      );
      expect(result.barcode).toBeNull();
    });
  });

  describe('countryCodes', () => {
    const fakeUser = {
      id: 'member-1',
      email: 'a@a.com',
      displayName: 'A',
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      passwordHash: 'x',
    };

    it('attaches the given country codes on create', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat1',
        householdId: null,
        isSystem: true,
        metadataSchema: null,
      });
      prisma.householdMember.findMany.mockResolvedValue([{ userId: 'member-1' }]);
      const txItem = {
        id: 'item1',
        householdId: 'h1',
        title: 'Dune',
        description: null,
        condition: ItemCondition.GOOD,
        rating: null,
        coverImageUrl: null,
        notes: null,
        customMetadata: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat1' },
        owners: [],
        countries: [{ countryCode: 'FR' }, { countryCode: 'BE' }],
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
        ownerIds: ['member-1'],
        countryCodes: ['FR', 'BE'],
      });

      expect(itemCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            countries: { create: [{ countryCode: 'FR' }, { countryCode: 'BE' }] },
          }),
        }),
      );
      expect(result.countryCodes).toEqual(['BE', 'FR']);
    });

    it('replaces country codes on update when provided, deleting the previous set first', async () => {
      const existing = {
        id: 'item1',
        householdId: 'h1',
        categoryId: 'cat1',
        title: 'Dune',
        description: null,
        condition: ItemCondition.GOOD,
        rating: null,
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
      const updated = {
        ...existing,
        category: { id: 'cat1' },
        countries: [{ countryCode: 'JP' }],
        bookMetadata: null,
        cdMetadata: null,
        dvdMetadata: null,
        createdBy: fakeUser,
        updatedBy: fakeUser,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const itemUpdate = jest.fn().mockResolvedValue(updated);
      const itemCountryDeleteMany = jest.fn().mockResolvedValue({});
      const auditLogCreate = jest.fn().mockResolvedValue({});
      prisma.$transaction.mockImplementation(
        async (
          fn: (tx: {
            item: { update: typeof itemUpdate };
            itemCountry: { deleteMany: typeof itemCountryDeleteMany };
            auditLog: { create: typeof auditLogCreate };
          }) => unknown,
        ) =>
          fn({
            item: { update: itemUpdate },
            itemCountry: { deleteMany: itemCountryDeleteMany },
            auditLog: { create: auditLogCreate },
          }),
      );

      const result = await service.update('h1', 'item1', 'u1', { countryCodes: ['JP'] });

      expect(itemCountryDeleteMany).toHaveBeenCalledWith({ where: { itemId: 'item1' } });
      expect(itemUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ countries: { create: [{ countryCode: 'JP' }] } }),
        }),
      );
      expect(result.countryCodes).toEqual(['JP']);
    });

    it('leaves existing country codes untouched when omitted from the patch', async () => {
      const existing = {
        id: 'item1',
        householdId: 'h1',
        categoryId: 'cat1',
        title: 'Dune',
        description: null,
        condition: ItemCondition.GOOD,
        rating: null,
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
      const updated = {
        ...existing,
        category: { id: 'cat1' },
        countries: [{ countryCode: 'FR' }],
        bookMetadata: null,
        cdMetadata: null,
        dvdMetadata: null,
        createdBy: fakeUser,
        updatedBy: fakeUser,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const itemUpdate = jest.fn().mockResolvedValue(updated);
      const itemCountryDeleteMany = jest.fn().mockResolvedValue({});
      const auditLogCreate = jest.fn().mockResolvedValue({});
      prisma.$transaction.mockImplementation(
        async (
          fn: (tx: {
            item: { update: typeof itemUpdate };
            itemCountry: { deleteMany: typeof itemCountryDeleteMany };
            auditLog: { create: typeof auditLogCreate };
          }) => unknown,
        ) =>
          fn({
            item: { update: itemUpdate },
            itemCountry: { deleteMany: itemCountryDeleteMany },
            auditLog: { create: auditLogCreate },
          }),
      );

      await service.update('h1', 'item1', 'u1', { title: 'Dune (nouvelle édition)' });

      expect(itemCountryDeleteMany).not.toHaveBeenCalled();
      expect(itemUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ countries: undefined }) }),
      );
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
        countries: [],
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

describe('ItemsService.update — effacement des champs facultatifs (Lot 2)', () => {
  let prisma: {
    category: { findUnique: jest.Mock };
    householdMember: { findMany: jest.Mock };
    item: { findUnique: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: ItemsService;
  let itemUpdate: jest.Mock;

  const fakeUser = {
    id: 'u1',
    email: 'a@a.com',
    displayName: 'A',
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    passwordHash: 'x',
  };

  /** Item existant avec TOUS les champs facultatifs renseignés. */
  const EXISTING = {
    id: 'item1',
    householdId: 'h1',
    categoryId: 'cat1',
    title: 'Dune',
    barcode: '3600029412578',
    description: 'Un classique de la SF.',
    condition: ItemCondition.GOOD,
    rating: 4.5,
    notes: 'Dédicacé.',
    coverImageUrl: 'https://cdn.test/dune.jpg',
    customMetadata: null,
    archivedAt: null,
    owners: [],
  };

  beforeEach(() => {
    prisma = {
      category: { findUnique: jest.fn() },
      householdMember: { findMany: jest.fn() },
      item: { findUnique: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(),
    };
    service = new ItemsService(
      prisma as unknown as PrismaService,
      { validateCustomMetadata: jest.fn() } as unknown as CategoriesService,
    );
    prisma.item.findUnique.mockResolvedValue(EXISTING);
    prisma.category.findUnique.mockResolvedValue({
      id: 'cat1',
      householdId: null,
      isSystem: true,
      metadataSchema: null,
    });
    itemUpdate = jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      ...EXISTING,
      ...data,
      owners: [],
      category: { id: 'cat1' },
      countries: [],
      bookMetadata: null,
      cdMetadata: null,
      dvdMetadata: null,
      createdBy: fakeUser,
      updatedBy: fakeUser,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const auditLogCreate = jest.fn().mockResolvedValue({});
    prisma.$transaction.mockImplementation(
      async (
        fn: (tx: {
          item: { update: typeof itemUpdate };
          auditLog: { create: typeof auditLogCreate };
        }) => unknown,
      ) => fn({ item: { update: itemUpdate }, auditLog: { create: auditLogCreate } }),
    );
  });

  function sentData(): Record<string, unknown> {
    return (itemUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
  }

  it.each(['description', 'notes', 'coverImageUrl', 'rating'] as const)(
    '%s: explicit null clears the existing value',
    async (field) => {
      const result = await service.update('h1', 'item1', 'u1', { [field]: null });

      expect(sentData()[field]).toBeNull();
      expect(result[field]).toBeNull();
    },
  );

  it.each(['description', 'notes', 'coverImageUrl', 'rating'] as const)(
    '%s: absent (undefined) keeps the existing value — never cleared by omission',
    async (field) => {
      await service.update('h1', 'item1', 'u1', { title: 'Dune (poche)' });

      expect(sentData()[field]).toBe(EXISTING[field]);
    },
  );

  it('distinguishes { field: undefined } from { field: null } in the same patch', async () => {
    await service.update('h1', 'item1', 'u1', { description: undefined, notes: null });

    expect(sentData().description).toBe(EXISTING.description);
    expect(sentData().notes).toBeNull();
  });

  it('replaces a value with a new non-null one', async () => {
    await service.update('h1', 'item1', 'u1', { description: 'Nouvelle description', rating: 2 });

    expect(sentData().description).toBe('Nouvelle description');
    expect(sentData().rating).toBe(2);
  });

  it('barcode keeps its contract: undefined unchanged, null cleared, string replaced', async () => {
    await service.update('h1', 'item1', 'u1', {});
    expect(sentData().barcode).toBe(EXISTING.barcode);

    itemUpdate.mockClear();
    await service.update('h1', 'item1', 'u1', { barcode: null });
    expect(sentData().barcode).toBeNull();

    itemUpdate.mockClear();
    await service.update('h1', 'item1', 'u1', { barcode: '0000000000000' });
    expect(sentData().barcode).toBe('0000000000000');
  });

  describe('category metadata (upsert: null clears a column, an absent key is left untouched)', () => {
    function sentUpsert(relation: 'bookMetadata' | 'cdMetadata' | 'dvdMetadata') {
      return (sentData()[relation] as { upsert: { update: Record<string, unknown> } }).upsert
        .update;
    }

    it('book: null author/publisher/year/pages reach Prisma as null, untouched keys stay absent', async () => {
      await service.update('h1', 'item1', 'u1', {
        book: { author: null, publisher: null, publicationYear: null, pageCount: null },
      });

      const update = sentUpsert('bookMetadata');
      expect(update).toEqual({
        author: null,
        publisher: null,
        publicationYear: null,
        pageCount: null,
      });
      expect('isbn' in update).toBe(false);
    });

    it('cd: null artist/label/releaseYear reach Prisma as null', async () => {
      await service.update('h1', 'item1', 'u1', {
        cd: { artist: null, label: null, releaseYear: null },
      });

      expect(sentUpsert('cdMetadata')).toEqual({ artist: null, label: null, releaseYear: null });
    });

    it('dvd: null director/edition/durationMinutes reach Prisma as null, a new value replaces', async () => {
      await service.update('h1', 'item1', 'u1', {
        dvd: { director: null, edition: null, durationMinutes: null, region: 'Zone 2' },
      });

      expect(sentUpsert('dvdMetadata')).toEqual({
        director: null,
        edition: null,
        durationMinutes: null,
        region: 'Zone 2',
      });
    });
  });
});
