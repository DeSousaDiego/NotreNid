import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { HouseholdRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { HOUSEHOLD_ROLES_KEY } from '../decorators/household-roles.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Vérifie que l'utilisateur authentifié appartient au household désigné par
 * le paramètre de route `householdId`, sans jamais faire confiance à ce
 * paramètre reçu du client. Applique en plus la restriction de rôle posée
 * par `@HouseholdRoles(...)` si présente. Doit être utilisé après `JwtAuthGuard`.
 */
@Injectable()
export class HouseholdMembershipGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const householdId = request.params.householdId;
    if (!householdId) {
      throw new ForbiddenException("Aucun household n'est ciblé par cette route.");
    }

    const membership = await this.prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId: request.user.id } },
    });

    if (!membership) {
      throw new ForbiddenException("Vous n'êtes pas membre de ce household.");
    }

    const requiredRoles = this.reflector.getAllAndOverride<HouseholdRole[] | undefined>(
      HOUSEHOLD_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException('Votre rôle ne permet pas cette action.');
    }

    request.householdMembership = { role: membership.role };
    return true;
  }
}
