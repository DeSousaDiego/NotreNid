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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CreateItemDto } from './dto/create-item.dto';
import { ItemsQueryDto } from './dto/items-query.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItemsService } from './items.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { HouseholdMembershipGuard } from '../common/guards/household-membership.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiStandardErrors } from '../common/swagger/api-standard-errors.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-request';

@ApiTags('items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
@Controller('households/:householdId/items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  @ApiOperation({
    summary: 'Liste les items du household, avec recherche, filtres, tri et pagination.',
  })
  @ApiResponse({ status: 200, description: 'Page de résultats paginée.' })
  @ApiStandardErrors(400, 401, 403, 404)
  findAll(@Param('householdId') householdId: string, @Query() query: ItemsQueryDto) {
    return this.itemsService.findAll(householdId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Ajoute un item au household, avec un ou plusieurs propriétaires.' })
  @ApiResponse({ status: 201, description: 'Item créé.' })
  @ApiStandardErrors(400, 401, 403, 404)
  create(
    @Param('householdId') householdId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateItemDto,
  ) {
    return this.itemsService.create(householdId, user.id, dto);
  }

  @Get(':itemId')
  @ApiOperation({ summary: "Retourne le détail d'un item, avec ses métadonnées spécifiques." })
  @ApiResponse({ status: 200, description: 'Item trouvé.' })
  @ApiStandardErrors(401, 403, 404)
  findOne(@Param('householdId') householdId: string, @Param('itemId') itemId: string) {
    return this.itemsService.findOne(householdId, itemId);
  }

  @Patch(':itemId')
  @ApiOperation({ summary: 'Modifie un item (champs communs, métadonnées ou propriétaires).' })
  @ApiResponse({ status: 200, description: 'Item mis à jour.' })
  @ApiStandardErrors(400, 401, 403, 404)
  update(
    @Param('householdId') householdId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateItemDto,
  ) {
    return this.itemsService.update(householdId, itemId, user.id, dto);
  }

  @Delete(':itemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive un item (suppression logique, restaurable).' })
  @ApiResponse({ status: 200, description: 'Item archivé.' })
  @ApiStandardErrors(401, 403, 404)
  archive(
    @Param('householdId') householdId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.itemsService.archive(householdId, itemId, user.id);
  }

  @Post(':itemId/restore')
  @ApiOperation({ summary: 'Restaure un item précédemment archivé.' })
  @ApiResponse({ status: 201, description: 'Item restauré.' })
  @ApiStandardErrors(401, 403, 404)
  restore(
    @Param('householdId') householdId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.itemsService.restore(householdId, itemId, user.id);
  }
}
