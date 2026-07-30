import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HouseholdRole } from '@prisma/client';

import { HouseholdMembershipGuard } from './household-membership.guard';
import type { PrismaService } from '../../prisma/prisma.service';

class DummyController {
  dummyHandler(): void {
    /* noop, used only as a Reflector metadata target */
  }
}

function createContext(params: Record<string, string>, user: { id: string }): ExecutionContext {
  const request = { params, user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => DummyController.prototype.dummyHandler,
    getClass: () => DummyController,
  } as unknown as ExecutionContext;
}

describe('HouseholdMembershipGuard', () => {
  let prisma: { householdMember: { findUnique: jest.Mock } };
  let reflector: Reflector;
  let guard: HouseholdMembershipGuard;

  beforeEach(() => {
    prisma = { householdMember: { findUnique: jest.fn() } };
    reflector = new Reflector();
    guard = new HouseholdMembershipGuard(prisma as unknown as PrismaService, reflector);
  });

  it('rejects a user who is not a member of the household', async () => {
    prisma.householdMember.findUnique.mockResolvedValue(null);
    const context = createContext({ householdId: 'h1' }, { id: 'u1' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a member without a specific role requirement', async () => {
    prisma.householdMember.findUnique.mockResolvedValue({ role: HouseholdRole.MEMBER });
    const context = createContext({ householdId: 'h1' }, { id: 'u1' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects a MEMBER on a route restricted to OWNER/ADMIN', async () => {
    prisma.householdMember.findUnique.mockResolvedValue({ role: HouseholdRole.MEMBER });
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([HouseholdRole.OWNER, HouseholdRole.ADMIN]);
    const context = createContext({ householdId: 'h1' }, { id: 'u1' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an ADMIN on a route restricted to OWNER/ADMIN', async () => {
    prisma.householdMember.findUnique.mockResolvedValue({ role: HouseholdRole.ADMIN });
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([HouseholdRole.OWNER, HouseholdRole.ADMIN]);
    const context = createContext({ householdId: 'h1' }, { id: 'u1' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
