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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CreateItemDto } from './dto/create-item.dto';
import { ItemsQueryDto } from './dto/items-query.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItemsService } from './items.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { HouseholdMembershipGuard } from '../common/guards/household-membership.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-request';

@ApiTags('items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
@Controller('households/:householdId/items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  findAll(@Param('householdId') householdId: string, @Query() query: ItemsQueryDto) {
    return this.itemsService.findAll(householdId, query);
  }

  @Post()
  create(
    @Param('householdId') householdId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateItemDto,
  ) {
    return this.itemsService.create(householdId, user.id, dto);
  }

  @Get(':itemId')
  findOne(@Param('householdId') householdId: string, @Param('itemId') itemId: string) {
    return this.itemsService.findOne(householdId, itemId);
  }

  @Patch(':itemId')
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
  archive(
    @Param('householdId') householdId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.itemsService.archive(householdId, itemId, user.id);
  }

  @Post(':itemId/restore')
  restore(
    @Param('householdId') householdId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.itemsService.restore(householdId, itemId, user.id);
  }
}
