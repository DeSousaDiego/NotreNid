import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

// Signature PNG : suffisante pour la détection de type par contenu (image-signature.ts).
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

// STORAGE_DRIVER=local en test (test/test-environment.ts) : fichiers sous apps/api/storage/uploads.
const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), 'storage', 'uploads');
const storedFileExists = (storageKey: string) =>
  existsSync(path.join(LOCAL_UPLOAD_DIR, storageKey));

describe('Uploads — household isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  async function registerUser(label: string) {
    const response = await request(server())
      .post('/api/v1/auth/register')
      .send({
        email: `e2e-${label}-${randomUUID()}@test.local`,
        password: 'password123',
        displayName: label,
      });
    return {
      id: response.body.user.id as string,
      accessToken: response.body.accessToken as string,
    };
  }

  async function createHousehold(accessToken: string, name: string) {
    const response = await request(server())
      .post('/api/v1/households')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name });
    return response.body.id as string;
  }

  function upload(accessToken: string, householdId: string) {
    return request(server())
      .post(`/api/v1/households/${householdId}/uploads`)
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', PNG_BYTES, { filename: 'cover.png', contentType: 'image/png' });
  }

  function remove(accessToken: string, householdId: string, uploadId: string) {
    return request(server())
      .delete(`/api/v1/households/${householdId}/uploads/${uploadId}`)
      .set('Authorization', `Bearer ${accessToken}`);
  }

  it('records each upload in the household of the route, never of a client-supplied field', async () => {
    const alex = await registerUser('upl-alex');
    const householdA = await createHousehold(alex.accessToken, 'Foyer A');
    const otherHousehold = await createHousehold(alex.accessToken, 'Autre foyer');

    const response = await request(server())
      .post(`/api/v1/households/${householdA}/uploads`)
      .set('Authorization', `Bearer ${alex.accessToken}`)
      .field('householdId', otherHousehold)
      .attach('file', PNG_BYTES, { filename: 'cover.png', contentType: 'image/png' })
      .expect(201);

    const record = await prisma.upload.findUniqueOrThrow({ where: { id: response.body.id } });
    expect(record.householdId).toBe(householdA);
    expect(record.uploadedById).toBe(alex.id);
    expect(record.kind).toBe('ITEM_COVER');
    expect(response.body.id).not.toBe(record.storageKey);
    expect(response.body.url).toContain(record.storageKey);
    expect(storedFileExists(record.storageKey)).toBe(true);
  });

  it('refuses every cross-household deletion attempt and leaves the file and its record intact', async () => {
    const alex = await registerUser('upl-victim');
    const bob = await registerUser('upl-attacker');
    const householdA = await createHousehold(alex.accessToken, 'Foyer A');
    const householdB = await createHousehold(bob.accessToken, 'Foyer B');

    const { body } = await upload(alex.accessToken, householdA).expect(201);
    const uploadId = body.id as string;
    const { storageKey } = await prisma.upload.findUniqueOrThrow({ where: { id: uploadId } });

    // Vecteur d'origine : membre de B, nom de fichier de A visible dans l'URL publique.
    await remove(bob.accessToken, householdB, storageKey).expect(404);
    // Identifiant d'upload de A, présenté sous le foyer B.
    await remove(bob.accessToken, householdB, uploadId).expect(404);
    // Route du foyer A, sans en être membre.
    await remove(bob.accessToken, householdA, uploadId).expect(403);
    // Téléversement dans un foyer dont on n'est pas membre.
    await upload(bob.accessToken, householdA).expect(403);

    expect(storedFileExists(storageKey)).toBe(true);
    await expect(prisma.upload.findUnique({ where: { id: uploadId } })).resolves.not.toBeNull();
  });

  it('answers 404 for an unknown upload', async () => {
    const alex = await registerUser('upl-unknown');
    const householdA = await createHousehold(alex.accessToken, 'Foyer A');

    await remove(alex.accessToken, householdA, randomUUID()).expect(404);
  });

  it('deletes an upload of the same household from storage and database together', async () => {
    const alex = await registerUser('upl-owner');
    const sam = await registerUser('upl-member');
    const householdA = await createHousehold(alex.accessToken, 'Foyer A');
    await prisma.householdMember.create({
      data: { householdId: householdA, userId: sam.id, role: 'MEMBER' },
    });

    const { body } = await upload(alex.accessToken, householdA).expect(201);
    const { storageKey } = await prisma.upload.findUniqueOrThrow({ where: { id: body.id } });

    // Tout membre du foyer peut gérer les couvertures (comme les items), pas seulement l'auteur.
    await remove(sam.accessToken, householdA, body.id).expect(204);

    expect(storedFileExists(storageKey)).toBe(false);
    await expect(prisma.upload.findUnique({ where: { id: body.id } })).resolves.toBeNull();
    await remove(sam.accessToken, householdA, body.id).expect(404);
  });
});
