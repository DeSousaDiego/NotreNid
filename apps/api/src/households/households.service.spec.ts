import { HouseholdRole } from '@prisma/client';

import { HouseholdsService } from './households.service';
import type { AppException } from '../common/exceptions/app-exception';
import type { PrismaService } from '../prisma/prisma.service';

describe('HouseholdsService', () => {
  let prisma: {
    householdMember: {
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
  };
  let service: HouseholdsService;

  beforeEach(() => {
    prisma = {
      householdMember: {
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };
    service = new HouseholdsService(prisma as unknown as PrismaService);
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
