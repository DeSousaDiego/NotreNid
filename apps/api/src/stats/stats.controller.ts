import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { StatsService } from './stats.service';
import { HouseholdMembershipGuard } from '../common/guards/household-membership.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('stats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
@Controller('households/:householdId/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  getStats(@Param('householdId') householdId: string) {
    return this.statsService.getStats(householdId);
  }
}
