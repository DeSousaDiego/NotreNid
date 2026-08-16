import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ExportsService } from './exports.service';
import { HouseholdMembershipGuard } from '../common/guards/household-membership.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiStandardErrors } from '../common/swagger/api-standard-errors.decorator';

@ApiTags('exports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
@Controller('households/:householdId/exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get('json')
  @ApiOperation({ summary: 'Exporte la collection active du household au format JSON.' })
  @ApiResponse({ status: 200, description: 'Collection exportée en JSON.' })
  @ApiStandardErrors(401, 403, 404)
  exportJson(@Param('householdId') householdId: string) {
    return this.exportsService.exportJson(householdId);
  }

  @Get('csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="collection.csv"')
  @ApiOperation({ summary: 'Exporte la collection active du household au format CSV.' })
  @ApiResponse({ status: 200, description: 'Collection exportée en CSV.' })
  @ApiStandardErrors(401, 403, 404)
  exportCsv(@Param('householdId') householdId: string) {
    return this.exportsService.exportCsv(householdId);
  }
}
