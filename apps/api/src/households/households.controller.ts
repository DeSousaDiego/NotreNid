import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HouseholdRole } from '@prisma/client';

import { CreateHouseholdDto } from './dto/create-household.dto';
import { UpdateHouseholdDto } from './dto/update-household.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { HouseholdsService } from './households.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { HouseholdRoles } from '../common/decorators/household-roles.decorator';
import { HouseholdMembershipGuard } from '../common/guards/household-membership.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { toPublicUser } from '../common/mappers/public-user.mapper';
import { ApiStandardErrors } from '../common/swagger/api-standard-errors.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-request';

@ApiTags('households')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('households')
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Get()
  @ApiOperation({ summary: "Liste les households dont l'utilisateur courant est membre." })
  @ApiResponse({
    status: 200,
    description: "Households de l'utilisateur, avec son rôle dans chacun.",
  })
  @ApiStandardErrors(401)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.householdsService.listForUser(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Crée un household ; le créateur en devient OWNER.' })
  @ApiResponse({ status: 201, description: 'Household créé.' })
  @ApiStandardErrors(400, 401)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateHouseholdDto) {
    return this.householdsService.create(user.id, dto.name);
  }

  @Get(':householdId')
  @UseGuards(HouseholdMembershipGuard)
  @ApiOperation({ summary: "Retourne les informations d'un household." })
  @ApiResponse({ status: 200, description: 'Household trouvé.' })
  @ApiStandardErrors(401, 403, 404)
  getById(@Param('householdId') householdId: string) {
    return this.householdsService.getById(householdId);
  }

  @Patch(':householdId')
  @UseGuards(HouseholdMembershipGuard)
  @HouseholdRoles(HouseholdRole.OWNER, HouseholdRole.ADMIN)
  @ApiOperation({ summary: 'Renomme un household (réservé à OWNER/ADMIN).' })
  @ApiResponse({ status: 200, description: 'Household renommé.' })
  @ApiStandardErrors(400, 401, 403, 404)
  rename(@Param('householdId') householdId: string, @Body() dto: UpdateHouseholdDto) {
    return this.householdsService.rename(householdId, dto.name);
  }

  @Delete(':householdId')
  @UseGuards(HouseholdMembershipGuard)
  @HouseholdRoles(HouseholdRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprime un household (réservé à OWNER).' })
  @ApiResponse({ status: 204, description: 'Household supprimé.' })
  @ApiStandardErrors(401, 403, 404)
  async remove(@Param('householdId') householdId: string): Promise<void> {
    await this.householdsService.remove(householdId);
  }

  @Get(':householdId/members')
  @UseGuards(HouseholdMembershipGuard)
  @ApiOperation({ summary: "Liste les membres d'un household." })
  @ApiResponse({ status: 200, description: 'Membres du household, avec leur rôle.' })
  @ApiStandardErrors(401, 403, 404)
  async listMembers(@Param('householdId') householdId: string) {
    const members = await this.householdsService.listMembers(householdId);
    return members.map((member) => ({
      id: member.id,
      role: member.role,
      joinedAt: member.joinedAt,
      user: toPublicUser(member.user),
    }));
  }

  @Patch(':householdId/members/:userId')
  @UseGuards(HouseholdMembershipGuard)
  @HouseholdRoles(HouseholdRole.OWNER, HouseholdRole.ADMIN)
  @ApiOperation({ summary: "Change le rôle d'un membre (réservé à OWNER/ADMIN)." })
  @ApiResponse({ status: 200, description: 'Rôle mis à jour.' })
  @ApiStandardErrors(400, 401, 403, 404, 409)
  updateMemberRole(
    @Param('householdId') householdId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.householdsService.updateMemberRole(householdId, targetUserId, dto.role);
  }

  @Delete(':householdId/members/:userId')
  @UseGuards(HouseholdMembershipGuard)
  @HouseholdRoles(HouseholdRole.OWNER, HouseholdRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Retire un membre du household (réservé à OWNER/ADMIN).' })
  @ApiResponse({ status: 204, description: 'Membre retiré.' })
  @ApiStandardErrors(401, 403, 404, 409)
  async removeMember(
    @Param('householdId') householdId: string,
    @Param('userId') targetUserId: string,
  ): Promise<void> {
    await this.householdsService.removeMember(householdId, targetUserId);
  }

  @Post(':householdId/leave')
  @UseGuards(HouseholdMembershipGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Fait quitter le household courant à l’utilisateur authentifié.' })
  @ApiResponse({ status: 204, description: 'Household quitté.' })
  @ApiStandardErrors(401, 403, 404, 409)
  async leave(
    @Param('householdId') householdId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.householdsService.leave(householdId, user.id);
  }
}
