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

import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { HouseholdRoles } from '../common/decorators/household-roles.decorator';
import { HouseholdMembershipGuard } from '../common/guards/household-membership.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiStandardErrors } from '../common/swagger/api-standard-errors.decorator';

@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
@Controller('households/:householdId/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Liste les catégories (système et personnalisées) du household.' })
  @ApiResponse({ status: 200, description: 'Catégories disponibles.' })
  @ApiStandardErrors(401, 403, 404)
  list(@Param('householdId') householdId: string) {
    return this.categoriesService.listForHousehold(householdId);
  }

  @Post()
  @HouseholdRoles(HouseholdRole.OWNER, HouseholdRole.ADMIN)
  @ApiOperation({ summary: 'Crée une catégorie personnalisée (réservé à OWNER/ADMIN).' })
  @ApiResponse({ status: 201, description: 'Catégorie créée.' })
  @ApiStandardErrors(400, 401, 403, 404, 409)
  create(@Param('householdId') householdId: string, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(householdId, dto);
  }

  @Patch(':categoryId')
  @HouseholdRoles(HouseholdRole.OWNER, HouseholdRole.ADMIN)
  @ApiOperation({ summary: 'Modifie une catégorie personnalisée (réservé à OWNER/ADMIN).' })
  @ApiResponse({ status: 200, description: 'Catégorie mise à jour.' })
  @ApiStandardErrors(400, 401, 403, 404, 409)
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
  @ApiOperation({
    summary:
      'Supprime une catégorie personnalisée (réservé à OWNER/ADMIN). Les catégories système ne sont pas supprimables.',
  })
  @ApiResponse({ status: 204, description: 'Catégorie supprimée.' })
  @ApiStandardErrors(401, 403, 404, 409)
  async remove(
    @Param('householdId') householdId: string,
    @Param('categoryId') categoryId: string,
  ): Promise<void> {
    await this.categoriesService.remove(householdId, categoryId);
  }
}
