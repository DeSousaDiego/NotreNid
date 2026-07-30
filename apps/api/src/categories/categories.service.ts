import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AppException } from '../common/exceptions/app-exception';
import { slugify } from '../common/utils/slugify';
import { PrismaService } from '../prisma/prisma.service';
import type { CategoryFieldSchemaDto } from './dto/category-field-schema.dto';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForHousehold(householdId: string) {
    return this.prisma.category.findMany({
      where: { OR: [{ householdId: null }, { householdId }] },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async create(householdId: string, dto: CreateCategoryDto) {
    const slug = slugify(dto.name);
    try {
      return await this.prisma.category.create({
        data: {
          householdId,
          name: dto.name,
          slug,
          icon: dto.icon,
          isSystem: false,
          metadataSchema: (dto.metadataSchema ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException(
          HttpStatus.CONFLICT,
          'CATEGORY_ALREADY_EXISTS',
          'Une catégorie avec un nom équivalent existe déjà dans ce foyer.',
        );
      }
      throw error;
    }
  }

  async update(householdId: string, categoryId: string, dto: UpdateCategoryDto) {
    const category = await this.getOwnedCustomCategory(householdId, categoryId);

    return this.prisma.category.update({
      where: { id: category.id },
      data: {
        name: dto.name ?? category.name,
        slug: dto.name ? slugify(dto.name) : category.slug,
        icon: dto.icon ?? category.icon,
        metadataSchema:
          dto.metadataSchema !== undefined
            ? (dto.metadataSchema as unknown as Prisma.InputJsonValue)
            : (category.metadataSchema ?? undefined),
      },
    });
  }

  async remove(householdId: string, categoryId: string): Promise<void> {
    const category = await this.getOwnedCustomCategory(householdId, categoryId);
    await this.prisma.category.delete({ where: { id: category.id } });
  }

  /** Valide `customMetadata` d'un item par rapport au `metadataSchema` de sa catégorie. */
  validateCustomMetadata(
    schema: CategoryFieldSchemaDto[] | null | undefined,
    metadata: Record<string, unknown> | null | undefined,
  ): void {
    if (!schema || schema.length === 0) return;
    const value = metadata ?? {};

    for (const field of schema) {
      const fieldValue = value[field.key];
      if (fieldValue === undefined || fieldValue === null) {
        if (field.required) {
          throw new AppException(
            HttpStatus.BAD_REQUEST,
            'VALIDATION_ERROR',
            `Le champ "${field.label}" est requis.`,
          );
        }
        continue;
      }
      if (!this.matchesType(fieldValue, field.type)) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          'VALIDATION_ERROR',
          `Le champ "${field.label}" doit être de type ${field.type}.`,
        );
      }
    }
  }

  private matchesType(value: unknown, type: CategoryFieldSchemaDto['type']): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      default:
        return false;
    }
  }

  private async getOwnedCustomCategory(householdId: string, categoryId: string) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || category.householdId !== householdId) {
      throw new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', "Cette catégorie n'existe pas.");
    }
    if (category.isSystem) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'SYSTEM_CATEGORY_READONLY',
        'Les catégories système ne peuvent pas être modifiées ni supprimées.',
      );
    }
    return category;
  }
}
