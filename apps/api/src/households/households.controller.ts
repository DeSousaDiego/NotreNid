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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
import type { AuthenticatedUser } from '../common/types/authenticated-request';

@ApiTags('households')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('households')
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.householdsService.listForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateHouseholdDto) {
    return this.householdsService.create(user.id, dto.name);
  }

  @Get(':householdId')
  @UseGuards(HouseholdMembershipGuard)
  getById(@Param('householdId') householdId: string) {
    return this.householdsService.getById(householdId);
  }

  @Patch(':householdId')
  @UseGuards(HouseholdMembershipGuard)
  @HouseholdRoles(HouseholdRole.OWNER, HouseholdRole.ADMIN)
  rename(@Param('householdId') householdId: string, @Body() dto: UpdateHouseholdDto) {
    return this.householdsService.rename(householdId, dto.name);
  }

  @Delete(':householdId')
  @UseGuards(HouseholdMembershipGuard)
  @HouseholdRoles(HouseholdRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('householdId') householdId: string): Promise<void> {
    await this.householdsService.remove(householdId);
  }

  @Get(':householdId/members')
  @UseGuards(HouseholdMembershipGuard)
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
  async removeMember(
    @Param('householdId') householdId: string,
    @Param('userId') targetUserId: string,
  ): Promise<void> {
    await this.householdsService.removeMember(householdId, targetUserId);
  }

  @Post(':householdId/leave')
  @UseGuards(HouseholdMembershipGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async leave(
    @Param('householdId') householdId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.householdsService.leave(householdId, user.id);
  }
}
