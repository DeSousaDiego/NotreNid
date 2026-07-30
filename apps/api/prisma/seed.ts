import path from 'node:path';

import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(process.cwd(), '../../.env') });

import { PrismaPg } from '@prisma/adapter-pg';
import { HouseholdRole, ItemCondition, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter });

/**
 * Comptes de démonstration — DÉVELOPPEMENT UNIQUEMENT.
 * Ne jamais utiliser ces identifiants en production (voir README.md).
 */
const DEMO_PASSWORD = 'notre-nid-demo';

async function upsertSystemCategories() {
  const categories = [
    { name: 'Livres', slug: 'book' },
    { name: 'CD', slug: 'cd' },
    { name: 'DVD', slug: 'dvd' },
  ];

  // Prisma refuse `null` dans une clé composée `@@unique` (householdId, slug) :
  // on ne peut pas utiliser upsert() ici, seulement findFirst + create conditionnel.
  const result: Record<string, string> = {};
  for (const category of categories) {
    const existing = await prisma.category.findFirst({
      where: { householdId: null, slug: category.slug },
    });
    const record =
      existing ??
      (await prisma.category.create({
        data: { name: category.name, slug: category.slug, isSystem: true, householdId: null },
      }));
    result[category.slug] = record.id;
  }
  return result;
}

async function main() {
  console.log('Seed — début.');

  const systemCategories = await upsertSystemCategories();

  const passwordHash = await argon2.hash(DEMO_PASSWORD);

  const alex = await prisma.user.upsert({
    where: { email: 'alex@notre-nid.demo' },
    update: {},
    create: { email: 'alex@notre-nid.demo', passwordHash, displayName: 'Alex' },
  });

  const sam = await prisma.user.upsert({
    where: { email: 'sam@notre-nid.demo' },
    update: {},
    create: { email: 'sam@notre-nid.demo', passwordHash, displayName: 'Sam' },
  });

  let household = await prisma.household.findFirst({ where: { name: 'Notre nid' } });
  if (!household) {
    household = await prisma.household.create({
      data: { name: 'Notre nid', createdById: alex.id },
    });
  }

  await prisma.householdMember.upsert({
    where: { householdId_userId: { householdId: household.id, userId: alex.id } },
    update: {},
    create: { householdId: household.id, userId: alex.id, role: HouseholdRole.OWNER },
  });
  await prisma.householdMember.upsert({
    where: { householdId_userId: { householdId: household.id, userId: sam.id } },
    update: {},
    create: { householdId: household.id, userId: sam.id, role: HouseholdRole.MEMBER },
  });

  const existingItems = await prisma.item.count({ where: { householdId: household.id } });
  if (existingItems === 0) {
    await prisma.item.create({
      data: {
        householdId: household.id,
        categoryId: systemCategories['book'],
        title: 'Dune',
        condition: ItemCondition.VERY_GOOD,
        createdById: alex.id,
        updatedById: alex.id,
        owners: { create: [{ userId: alex.id }] },
        bookMetadata: {
          create: { author: 'Frank Herbert', publisher: 'Chilton Books', publicationYear: 1965 },
        },
      },
    });

    await prisma.item.create({
      data: {
        householdId: household.id,
        categoryId: systemCategories['cd'],
        title: 'Discovery',
        condition: ItemCondition.GOOD,
        createdById: sam.id,
        updatedById: sam.id,
        owners: { create: [{ userId: sam.id }] },
        cdMetadata: { create: { artist: 'Daft Punk', releaseYear: 2001 } },
      },
    });

    await prisma.item.create({
      data: {
        householdId: household.id,
        categoryId: systemCategories['dvd'],
        title: 'Le Voyage de Chihiro',
        condition: ItemCondition.NEW,
        createdById: alex.id,
        updatedById: alex.id,
        owners: { create: [{ userId: alex.id }, { userId: sam.id }] },
        dvdMetadata: { create: { director: 'Hayao Miyazaki', releaseYear: 2001 } },
      },
    });

    const archivedItem = await prisma.item.create({
      data: {
        householdId: household.id,
        categoryId: systemCategories['book'],
        title: 'Ancien guide de voyage',
        condition: ItemCondition.POOR,
        createdById: sam.id,
        updatedById: sam.id,
        owners: { create: [{ userId: sam.id }] },
        bookMetadata: { create: { author: 'Collectif' } },
      },
    });
    await prisma.item.update({
      where: { id: archivedItem.id },
      data: { archivedAt: new Date() },
    });
  }

  console.log('Seed — terminé.');
  console.log(`Comptes de démonstration (mot de passe : "${DEMO_PASSWORD}") :`);
  console.log(`  - ${alex.email}`);
  console.log(`  - ${sam.email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
