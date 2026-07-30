import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { HouseholdMembershipGuard } from '../common/guards/household-membership.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

import { ExportsService } from './exports.service';

@ApiTags('exports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
@Controller('households/:householdId/exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get('json')
  exportJson(@Param('householdId') householdId: string) {
    return this.exportsService.exportJson(householdId);
  }

  @Get('csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="collection.csv"')
  exportCsv(@Param('householdId') householdId: string) {
    return this.exportsService.exportCsv(householdId);
  }
}
