import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HouseholdRole } from '@prisma/client';

import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationsService } from './invitations.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { HouseholdRoles } from '../common/decorators/household-roles.decorator';
import { HouseholdMembershipGuard } from '../common/guards/household-membership.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-request';

@ApiTags('invitations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
@Controller('households/:householdId/invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @HouseholdRoles(HouseholdRole.OWNER, HouseholdRole.ADMIN)
  create(
    @Param('householdId') householdId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitationsService.create(householdId, user.id, dto.email);
  }

  @Get()
  @HouseholdRoles(HouseholdRole.OWNER, HouseholdRole.ADMIN)
  list(@Param('householdId') householdId: string) {
    return this.invitationsService.listForHousehold(householdId);
  }
}
