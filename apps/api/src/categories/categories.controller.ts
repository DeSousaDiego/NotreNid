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

import { HouseholdRoles } from '../common/decorators/household-roles.decorator';
import { HouseholdMembershipGuard } from '../common/guards/household-membership.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
@Controller('households/:householdId/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list(@Param('householdId') householdId: string) {
    return this.categoriesService.listForHousehold(householdId);
  }

  @Post()
  @HouseholdRoles(HouseholdRole.OWNER, HouseholdRole.ADMIN)
  create(@Param('householdId') householdId: string, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(householdId, dto);
  }

  @Patch(':categoryId')
  @HouseholdRoles(HouseholdRole.OWNER, HouseholdRole.ADMIN)
  update(
    @Param('householdId') householdId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(householdId, categoryId, dto);
  }

  @Delete(':categoryId')
  @HouseholdRoles(HouseholdRole.OWNER, HouseholdRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('householdId') householdId: string,
    @Param('categoryId') categoryId: string,
  ): Promise<void> {
    await this.categoriesService.remove(householdId, categoryId);
  }
}
