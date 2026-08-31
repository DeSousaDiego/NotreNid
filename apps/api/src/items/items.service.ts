import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { CategoriesService } from '../categories/categories.service';
import type { CategoryFieldSchemaDto } from '../categories/dto/category-field-schema.dto';
import { buildPaginatedResult, type PaginatedResult } from '../common/dto/paginated-result';
import { AppException } from '../common/exceptions/app-exception';
import { toPublicUser } from '../common/mappers/public-user.mapper';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateItemDto } from './dto/create-item.dto';
import type { ItemsQueryDto } from './dto/items-query.dto';
import type { UpdateItemDto } from './dto/update-item.dto';

const ITEM_INCLUDE = {
  category: true,
  owners: { include: { user: true } },
  countries: true,
  bookMetadata: true,
  cdMetadata: true,
  dvdMetadata: true,
  createdBy: true,
  updatedBy: true,
} satisfies Prisma.ItemInclude;

type ItemWithRelations = Prisma.ItemGetPayload<{ include: typeof ITEM_INCLUDE }>;

@Injectable()
export class ItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async findAll(householdId: string, query: ItemsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ItemWhereInput = {
      householdId,
      archivedAt: query.archived ? { not: null } : null,
    };

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.condition) where.condition = query.condition;
    if (query.createdById) where.createdById = query.createdById;
    if (query.ownerId) {
      where.owners = { some: { userId: query.ownerId } };
    }
    if (query.search) {
      const contains = query.search;
      where.OR = [
        { title: { contains, mode: 'insensitive' } },
        { notes: { contains, mode: 'insensitive' } },
        { description: { contains, mode: 'insensitive' } },
        { bookMetadata: { is: { author: { contains, mode: 'insensitive' } } } },
        { bookMetadata: { is: { isbn: { contains, mode: 'insensitive' } } } },
        { cdMetadata: { is: { artist: { contains, mode: 'insensitive' } } } },
        { cdMetadata: { is: { album: { contains, mode: 'insensitive' } } } },
        { dvdMetadata: { is: { director: { contains, mode: 'insensitive' } } } },
      ];
    }

    const [items, totalItems] = await Promise.all([
      this.prisma.item.findMany({
        where,
        include: ITEM_INCLUDE,
        orderBy: { [query.sort ?? 'createdAt']: query.order ?? 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.item.count({ where }),
    ]);

    return buildPaginatedResult(
      items.map((item) => this.toResponse(item)),
      totalItems,
      page,
      pageSize,
    );
  }

  async findOne(householdId: string, itemId: string) {
    const item = await this.getOwnedItem(householdId, itemId);
    return this.toResponse(item);
  }

  async create(householdId: string, userId: string, dto: CreateItemDto) {
    const category = await this.getCategoryForHousehold(householdId, dto.categoryId);
    await this.assertOwnersBelongToHousehold(householdId, dto.ownerIds);
    this.validateMetadataForCategory(category, dto);

    const created = await this.prisma.$transaction(async (tx) => {
      const item = await tx.item.create({
        data: {
          householdId,
          categoryId: dto.categoryId,
          title: dto.title,
          description: dto.description,
          condition: dto.condition,
          rating: dto.rating,
          notes: dto.notes,
          coverImageUrl: dto.coverImageUrl,
          customMetadata: category.isSystem
            ? undefined
            : ((dto.customMetadata ?? undefined) as Prisma.InputJsonValue | undefined),
          createdById: userId,
          updatedById: userId,
          owners: { create: dto.ownerIds.map((ownerId) => ({ userId: ownerId })) },
          countries: dto.countryCodes
            ? { create: dto.countryCodes.map((countryCode) => ({ countryCode })) }
            : undefined,
          bookMetadata: dto.book ? { create: dto.book } : undefined,
          cdMetadata: dto.cd ? { create: dto.cd } : undefined,
          dvdMetadata: dto.dvd ? { create: dto.dvd } : undefined,
        },
        include: ITEM_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          householdId,
          userId,
          action: 'ITEM_CREATED',
          entityType: 'Item',
          entityId: item.id,
        },
      });

      return item;
    });

    return this.toResponse(created);
  }

  async update(householdId: string, itemId: string, userId: string, dto: UpdateItemDto) {
    const existing = await this.getOwnedItem(householdId, itemId);

    const categoryId = dto.categoryId ?? existing.categoryId;
    const category = await this.getCategoryForHousehold(householdId, categoryId);

    if (dto.ownerIds) {
      await this.assertOwnersBelongToHousehold(householdId, dto.ownerIds);
    }
    this.validateMetadataForCategory(category, dto);

    const ownersChanged =
      dto.ownerIds !== undefined &&
      !this.sameOwnerSet(
        existing.owners.map((o) => o.userId),
        dto.ownerIds,
      );

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.ownerIds) {
        await tx.itemOwner.deleteMany({ where: { itemId } });
      }
      if (dto.countryCodes) {
        await tx.itemCountry.deleteMany({ where: { itemId } });
      }

      const item = await tx.item.update({
        where: { id: itemId },
        data: {
          categoryId,
          title: dto.title ?? existing.title,
          description: dto.description ?? existing.description,
          condition: dto.condition ?? existing.condition,
          rating: dto.rating ?? existing.rating,
          notes: dto.notes ?? existing.notes,
          coverImageUrl: dto.coverImageUrl ?? existing.coverImageUrl,
          customMetadata: category.isSystem
            ? undefined
            : ((dto.customMetadata as Prisma.InputJsonValue | undefined) ??
              existing.customMetadata ??
              undefined),
          updatedById: userId,
          owners: dto.ownerIds
            ? { create: dto.ownerIds.map((ownerId) => ({ userId: ownerId })) }
            : undefined,
          countries: dto.countryCodes
            ? { create: dto.countryCodes.map((countryCode) => ({ countryCode })) }
            : undefined,
          bookMetadata: dto.book ? { upsert: { create: dto.book, update: dto.book } } : undefined,
          cdMetadata: dto.cd ? { upsert: { create: dto.cd, update: dto.cd } } : undefined,
          dvdMetadata: dto.dvd ? { upsert: { create: dto.dvd, update: dto.dvd } } : undefined,
        },
        include: ITEM_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          householdId,
          userId,
          action: 'ITEM_UPDATED',
          entityType: 'Item',
          entityId: item.id,
        },
      });

      if (ownersChanged) {
        await tx.auditLog.create({
          data: {
            householdId,
            userId,
            action: 'ITEM_OWNERS_CHANGED',
            entityType: 'Item',
            entityId: item.id,
            metadata: { ownerIds: dto.ownerIds },
          },
        });
      }

      return item;
    });

    return this.toResponse(updated);
  }

  async archive(householdId: string, itemId: string, userId: string) {
    const existing = await this.getOwnedItem(householdId, itemId);
    if (existing.archivedAt) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'ITEM_ALREADY_ARCHIVED',
        'Cet item est déjà archivé.',
      );
    }

    const item = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.item.update({
        where: { id: itemId },
        data: { archivedAt: new Date(), updatedById: userId },
        include: ITEM_INCLUDE,
      });
      await tx.auditLog.create({
        data: {
          householdId,
          userId,
          action: 'ITEM_ARCHIVED',
          entityType: 'Item',
          entityId: itemId,
        },
      });
      return updated;
    });

    return this.toResponse(item);
  }

  async restore(householdId: string, itemId: string, userId: string) {
    const existing = await this.getOwnedItem(householdId, itemId);
    if (!existing.archivedAt) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'ITEM_NOT_ARCHIVED',
        "Cet item n'est pas archivé.",
      );
    }

    const item = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.item.update({
        where: { id: itemId },
        data: { archivedAt: null, updatedById: userId },
        include: ITEM_INCLUDE,
      });
      await tx.auditLog.create({
        data: {
          householdId,
          userId,
          action: 'ITEM_RESTORED',
          entityType: 'Item',
          entityId: itemId,
        },
      });
      return updated;
    });

    return this.toResponse(item);
  }

  /**
   * Charge un item en vérifiant qu'il appartient bien au household ciblé.
   * Ne distingue jamais "item inexistant" de "item d'un autre household" :
   * c'est le cœur de l'isolation entre households (docs/NOTRE_NID_PRD.md section 15).
   */
  private async getOwnedItem(householdId: string, itemId: string): Promise<ItemWithRelations> {
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
      include: ITEM_INCLUDE,
    });
    if (!item || item.householdId !== householdId) {
      throw new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', "Cet item n'existe pas.");
    }
    return item;
  }

  private async getCategoryForHousehold(householdId: string, categoryId: string) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || (category.householdId !== null && category.householdId !== householdId)) {
      throw new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', "Cette catégorie n'existe pas.");
    }
    return category;
  }

  private async assertOwnersBelongToHousehold(
    householdId: string,
    ownerIds: string[],
  ): Promise<void> {
    const members = await this.prisma.householdMember.findMany({
      where: { householdId, userId: { in: ownerIds } },
      select: { userId: true },
    });
    const memberIds = new Set(members.map((m) => m.userId));
    const invalid = ownerIds.filter((id) => !memberIds.has(id));
    if (invalid.length > 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'OWNERS_NOT_MEMBERS',
        'Tous les propriétaires doivent être membres de ce household.',
      );
    }
  }

  private validateMetadataForCategory(
    category: { isSystem: boolean; metadataSchema: Prisma.JsonValue | null },
    dto: CreateItemDto | UpdateItemDto,
  ): void {
    if (!category.isSystem) {
      this.categoriesService.validateCustomMetadata(
        (category.metadataSchema as unknown as CategoryFieldSchemaDto[] | null) ?? null,
        dto.customMetadata ?? null,
      );
    }
  }

  private sameOwnerSet(current: string[], next: string[]): boolean {
    if (current.length !== next.length) return false;
    const currentSet = new Set(current);
    return next.every((id) => currentSet.has(id));
  }

  private toResponse(item: ItemWithRelations) {
    return {
      id: item.id,
      householdId: item.householdId,
      title: item.title,
      description: item.description,
      condition: item.condition,
      rating: item.rating,
      coverImageUrl: item.coverImageUrl,
      notes: item.notes,
      customMetadata: item.customMetadata,
      countryCodes: item.countries.map((c) => c.countryCode).sort(),
      archivedAt: item.archivedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      category: item.category,
      owners: item.owners.map((owner) => toPublicUser(owner.user)),
      book: item.bookMetadata,
      cd: item.cdMetadata,
      dvd: item.dvdMetadata,
      createdBy: toPublicUser(item.createdBy),
      updatedBy: toPublicUser(item.updatedBy),
    };
  }
}
