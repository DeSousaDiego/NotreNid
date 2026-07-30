import { Injectable } from '@nestjs/common';

import { toCsv } from './csv.util';
import { PrismaService } from '../prisma/prisma.service';

const CSV_COLUMNS = [
  'id',
  'title',
  'category',
  'condition',
  'owners',
  'archived',
  'createdAt',
  'author',
  'artist',
  'director',
  'notes',
];

@Injectable()
export class ExportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadItems(householdId: string) {
    return this.prisma.item.findMany({
      where: { householdId },
      include: {
        category: true,
        owners: { include: { user: true } },
        bookMetadata: true,
        cdMetadata: true,
        dvdMetadata: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async exportJson(householdId: string) {
    const items = await this.loadItems(householdId);
    return items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      category: item.category.name,
      condition: item.condition,
      owners: item.owners.map((owner) => owner.user.displayName),
      archived: item.archivedAt !== null,
      createdAt: item.createdAt,
      notes: item.notes,
      book: item.bookMetadata,
      cd: item.cdMetadata,
      dvd: item.dvdMetadata,
    }));
  }

  async exportCsv(householdId: string): Promise<string> {
    const items = await this.loadItems(householdId);
    const rows = items.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category.name,
      condition: item.condition,
      owners: item.owners.map((owner) => owner.user.displayName).join('; '),
      archived: item.archivedAt !== null,
      createdAt: item.createdAt.toISOString(),
      author: item.bookMetadata?.author ?? '',
      artist: item.cdMetadata?.artist ?? '',
      director: item.dvdMetadata?.director ?? '',
      notes: item.notes ?? '',
    }));
    return toCsv(rows, CSV_COLUMNS);
  }
}
