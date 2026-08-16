import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HouseholdRole } from '@prisma/client';

import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationsService } from './invitations.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { HouseholdRoles } from '../common/decorators/household-roles.decorator';
import { HouseholdMembershipGuard } from '../common/guards/household-membership.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiStandardErrors } from '../common/swagger/api-standard-errors.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-request';

@ApiTags('invitations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
@Controller('households/:householdId/invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @HouseholdRoles(HouseholdRole.OWNER, HouseholdRole.ADMIN)
  @ApiOperation({
    summary:
      "Invite un utilisateur à rejoindre le household par email (réservé à OWNER/ADMIN). En développement, le jeton d'acceptation est renvoyé en clair.",
  })
  @ApiResponse({ status: 201, description: 'Invitation créée.' })
  @ApiStandardErrors(400, 401, 403, 404)
  create(
    @Param('householdId') householdId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitationsService.create(householdId, user.id, dto.email);
  }

  @Get()
  @HouseholdRoles(HouseholdRole.OWNER, HouseholdRole.ADMIN)
  @ApiOperation({
    summary: 'Liste les invitations en attente du household (réservé à OWNER/ADMIN).',
  })
  @ApiResponse({ status: 200, description: 'Invitations en attente.' })
  @ApiStandardErrors(401, 403, 404)
  list(@Param('householdId') householdId: string) {
    return this.invitationsService.listForHousehold(householdId);
  }
}
