import { HttpStatus, Injectable } from '@nestjs/common';
import { HouseholdRole } from '@prisma/client';

import { AppException } from '../common/exceptions/app-exception';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HouseholdsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.householdMember.findMany({
      where: { userId },
      include: { household: true },
      orderBy: { joinedAt: 'asc' },
    });
    return memberships.map((m) => ({ ...m.household, role: m.role }));
  }

  async create(userId: string, name: string) {
    return this.prisma.$transaction(async (tx) => {
      const household = await tx.household.create({
        data: { name, createdById: userId },
      });
      await tx.householdMember.create({
        data: { householdId: household.id, userId, role: HouseholdRole.OWNER },
      });
      return { ...household, role: HouseholdRole.OWNER };
    });
  }

  async getById(householdId: string) {
    return this.prisma.household.findUniqueOrThrow({ where: { id: householdId } });
  }

  async rename(householdId: string, name: string) {
    return this.prisma.household.update({ where: { id: householdId }, data: { name } });
  }

  async remove(householdId: string): Promise<void> {
    await this.prisma.household.delete({ where: { id: householdId } });
  }

  async listMembers(householdId: string) {
    return this.prisma.householdMember.findMany({
      where: { householdId },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async updateMemberRole(householdId: string, targetUserId: string, role: HouseholdRole) {
    const target = await this.prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId: targetUserId } },
    });
    if (!target) {
      throw new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', "Ce membre n'existe pas.");
    }

    if (target.role === HouseholdRole.OWNER && role !== HouseholdRole.OWNER) {
      await this.assertNotLastOwner(householdId);
    }

    return this.prisma.householdMember.update({
      where: { householdId_userId: { householdId, userId: targetUserId } },
      data: { role },
    });
  }

  async removeMember(householdId: string, targetUserId: string): Promise<void> {
    const target = await this.prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId: targetUserId } },
    });
    if (!target) {
      throw new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', "Ce membre n'existe pas.");
    }

    if (target.role === HouseholdRole.OWNER) {
      await this.assertNotLastOwner(householdId);
    }

    await this.prisma.householdMember.delete({
      where: { householdId_userId: { householdId, userId: targetUserId } },
    });
  }

  async leave(householdId: string, userId: string): Promise<void> {
    await this.removeMember(householdId, userId);
  }

  /** Empêche de retirer/démettre le dernier OWNER d'un household. */
  private async assertNotLastOwner(householdId: string): Promise<void> {
    const ownerCount = await this.prisma.householdMember.count({
      where: { householdId, role: HouseholdRole.OWNER },
    });
    if (ownerCount <= 1) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'LAST_OWNER_CANNOT_LEAVE',
        "Le dernier propriétaire d'un household ne peut ni le quitter ni être rétrogradé/retiré.",
      );
    }
  }
}
