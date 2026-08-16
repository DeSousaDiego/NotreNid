import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { StatsService } from './stats.service';
import { HouseholdMembershipGuard } from '../common/guards/household-membership.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiStandardErrors } from '../common/swagger/api-standard-errors.decorator';

@ApiTags('stats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
@Controller('households/:householdId/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Retourne les statistiques du household (total actif, par catégorie, par propriétaire, ajouts récents, archivés).',
  })
  @ApiResponse({ status: 200, description: 'Statistiques du household.' })
  @ApiStandardErrors(401, 403, 404)
  getStats(@Param('householdId') householdId: string) {
    return this.statsService.getStats(householdId);
  }
}
