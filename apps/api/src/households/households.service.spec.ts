import { HouseholdRole } from '@prisma/client';

import { HouseholdsService } from './households.service';
import type { AppException } from '../common/exceptions/app-exception';
import type { PrismaService } from '../prisma/prisma.service';
import type { UploadsService } from '../uploads/uploads.service';

describe('HouseholdsService', () => {
  let prisma: {
    householdMember: {
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    upload: { findMany: jest.Mock };
    item: { deleteMany: jest.Mock };
    household: { delete: jest.Mock };
    $transaction: jest.Mock;
  };
  let uploadsService: { removeStoredFilesBestEffort: jest.Mock };
  let service: HouseholdsService;

  beforeEach(() => {
    prisma = {
      householdMember: {
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      upload: { findMany: jest.fn() },
      item: { deleteMany: jest.fn() },
      household: { delete: jest.fn() },
      $transaction: jest.fn(),
    };
    uploadsService = { removeStoredFilesBestEffort: jest.fn() };
    service = new HouseholdsService(
      prisma as unknown as PrismaService,
      uploadsService as unknown as UploadsService,
    );
  });

  describe('remove (household deletion and its uploaded files)', () => {
    beforeEach(() => {
      prisma.upload.findMany.mockResolvedValue([{ storageKey: 'a.jpg' }, { storageKey: 'b.png' }]);
      prisma.item.deleteMany.mockReturnValue('delete-items-op');
      prisma.household.delete.mockReturnValue('delete-household-op');
    });

    it('reads the storage keys first, deletes items then the household in one transaction, then the files', async () => {
      const calls: string[] = [];
      prisma.upload.findMany.mockImplementation(async () => {
        calls.push('read-keys');
        return [{ storageKey: 'a.jpg' }, { storageKey: 'b.png' }];
      });
      prisma.$transaction.mockImplementation(async () => {
        calls.push('db-transaction');
      });
      uploadsService.removeStoredFilesBestEffort.mockImplementation(async () => {
        calls.push('storage');
        return { removed: 2, failed: [] };
      });

      await service.remove('h1');

      expect(prisma.upload.findMany).toHaveBeenCalledWith({
        where: { householdId: 'h1' },
        select: { storageKey: true },
      });
      expect(prisma.item.deleteMany).toHaveBeenCalledWith({ where: { householdId: 'h1' } });
      expect(prisma.household.delete).toHaveBeenCalledWith({ where: { id: 'h1' } });
      expect(prisma.$transaction).toHaveBeenCalledWith(['delete-items-op', 'delete-household-op']);
      expect(uploadsService.removeStoredFilesBestEffort).toHaveBeenCalledWith(['a.jpg', 'b.png']);
      expect(calls).toEqual(['read-keys', 'db-transaction', 'storage']);
    });

    it('never touches storage when the database deletion fails (household still intact)', async () => {
      prisma.$transaction.mockRejectedValue(new Error('db down'));

      await expect(service.remove('h1')).rejects.toThrow('db down');
      expect(uploadsService.removeStoredFilesBestEffort).not.toHaveBeenCalled();
    });
  });

  describe('last-owner protection', () => {
    it('refuses to demote the last OWNER', async () => {
      prisma.householdMember.findUnique.mockResolvedValue({ role: HouseholdRole.OWNER });
      prisma.householdMember.count.mockResolvedValue(1);

      await expect(
        service.updateMemberRole('h1', 'u1', HouseholdRole.MEMBER),
      ).rejects.toMatchObject<Partial<AppException>>({ code: 'LAST_OWNER_CANNOT_LEAVE' });
      expect(prisma.householdMember.update).not.toHaveBeenCalled();
    });

    it('allows demoting an OWNER when another OWNER remains', async () => {
      prisma.householdMember.findUnique.mockResolvedValue({ role: HouseholdRole.OWNER });
      prisma.householdMember.count.mockResolvedValue(2);
      prisma.householdMember.update.mockResolvedValue({ role: HouseholdRole.MEMBER });

      await service.updateMemberRole('h1', 'u1', HouseholdRole.MEMBER);
      expect(prisma.householdMember.update).toHaveBeenCalled();
    });

    it('refuses to remove the last OWNER', async () => {
      prisma.householdMember.findUnique.mockResolvedValue({ role: HouseholdRole.OWNER });
      prisma.householdMember.count.mockResolvedValue(1);

      await expect(service.removeMember('h1', 'u1')).rejects.toMatchObject<Partial<AppException>>({
        code: 'LAST_OWNER_CANNOT_LEAVE',
      });
      expect(prisma.householdMember.delete).not.toHaveBeenCalled();
    });

    it('refuses to let the last OWNER leave', async () => {
      prisma.householdMember.findUnique.mockResolvedValue({ role: HouseholdRole.OWNER });
      prisma.householdMember.count.mockResolvedValue(1);

      await expect(service.leave('h1', 'u1')).rejects.toMatchObject<Partial<AppException>>({
        code: 'LAST_OWNER_CANNOT_LEAVE',
      });
    });

    it('allows a non-OWNER member to leave freely', async () => {
      prisma.householdMember.findUnique.mockResolvedValue({ role: HouseholdRole.MEMBER });
      prisma.householdMember.delete.mockResolvedValue({});

      await service.leave('h1', 'u1');
      expect(prisma.householdMember.delete).toHaveBeenCalled();
      expect(prisma.householdMember.count).not.toHaveBeenCalled();
    });
  });
});
