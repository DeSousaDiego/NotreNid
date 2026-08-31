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
      "Génère un nouveau code d'invitation pour ce household (réservé à OWNER/ADMIN). Un seul " +
      'code est actif à la fois : en créer un nouveau révoque silencieusement le précédent. ' +
      "Le code en clair n'est renvoyé qu'ici (jamais par la liste) — à charge pour le " +
      "demandeur de le partager. L'email est facultatif : s'il est fourni, une notification " +
      'best-effort est tentée en plus (`emailDelivered` en rend compte).',
  })
  @ApiResponse({ status: 201, description: 'Invitation créée avec son code en clair.' })
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
