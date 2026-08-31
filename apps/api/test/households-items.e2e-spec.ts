import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Households / Invitations / Items (e2e)', () => {
  let app: INestApplication;

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
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  async function registerUser(label: string) {
    const email = `e2e-${label}-${randomUUID()}@test.local`;
    const response = await request(server())
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123', displayName: label });
    return {
      email,
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

  async function createCategory(accessToken: string, householdId: string, name: string) {
    const response = await request(server())
      .post(`/api/v1/households/${householdId}/categories`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name });
    return response.body.id as string;
  }

  async function createItem(
    accessToken: string,
    householdId: string,
    categoryId: string,
    ownerIds: string[],
    title = 'Test Item',
  ) {
    const response = await request(server())
      .post(`/api/v1/households/${householdId}/items`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ categoryId, title, condition: 'GOOD', ownerIds });
    return response.body.id as string;
  }

  describe('full household lifecycle', () => {
    it('covers creation, invitation, membership, roles and the last-owner rule', async () => {
      const alex = await registerUser('alex');
      const sam = await registerUser('sam');

      const householdId = await createHousehold(alex.accessToken, 'Foyer e2e');

      // Alex generates an invitation code (no email required).
      const invitation = await request(server())
        .post(`/api/v1/households/${householdId}/invitations`)
        .set('Authorization', `Bearer ${alex.accessToken}`)
        .send({});
      expect(invitation.status).toBe(201);
      expect(typeof invitation.body.code).toBe('string');

      // Sam accepts using the raw code.
      const accept = await request(server())
        .post(`/api/v1/invitations/accept`)
        .set('Authorization', `Bearer ${sam.accessToken}`)
        .send({ code: invitation.body.code });
      expect(accept.status).toBe(201);

      // Sam is now a MEMBER and can list the household's members.
      const members = await request(server())
        .get(`/api/v1/households/${householdId}/members`)
        .set('Authorization', `Bearer ${sam.accessToken}`);
      expect(members.status).toBe(200);
      expect(members.body).toHaveLength(2);

      // A MEMBER cannot create a category.
      const forbiddenCategory = await request(server())
        .post(`/api/v1/households/${householdId}/categories`)
        .set('Authorization', `Bearer ${sam.accessToken}`)
        .send({ name: 'Interdit' });
      expect(forbiddenCategory.status).toBe(403);

      // Alex promotes Sam to ADMIN.
      const promote = await request(server())
        .patch(`/api/v1/households/${householdId}/members/${sam.id}`)
        .set('Authorization', `Bearer ${alex.accessToken}`)
        .send({ role: 'ADMIN' });
      expect(promote.status).toBe(200);
      expect(promote.body.role).toBe('ADMIN');

      // Sam, now ADMIN, can create a category.
      const allowedCategory = await request(server())
        .post(`/api/v1/households/${householdId}/categories`)
        .set('Authorization', `Bearer ${sam.accessToken}`)
        .send({ name: 'Autorisé' });
      expect(allowedCategory.status).toBe(201);

      // Alex is the only OWNER: cannot leave.
      const leave = await request(server())
        .post(`/api/v1/households/${householdId}/leave`)
        .set('Authorization', `Bearer ${alex.accessToken}`);
      expect(leave.status).toBe(409);
      expect(leave.body.code).toBe('LAST_OWNER_CANNOT_LEAVE');
    });
  });

  describe('items: CRUD, ownership and archiving', () => {
    it('supports create, read, update, archive and restore within one household', async () => {
      const alex = await registerUser('alex-items');
      const householdId = await createHousehold(alex.accessToken, 'Foyer items');
      const categoryId = await createCategory(alex.accessToken, householdId, 'Livres');
      const itemId = await createItem(alex.accessToken, householdId, categoryId, [alex.id], 'Dune');

      const getResponse = await request(server())
        .get(`/api/v1/households/${householdId}/items/${itemId}`)
        .set('Authorization', `Bearer ${alex.accessToken}`);
      expect(getResponse.status).toBe(200);
      expect(getResponse.body.title).toBe('Dune');

      const updateResponse = await request(server())
        .patch(`/api/v1/households/${householdId}/items/${itemId}`)
        .set('Authorization', `Bearer ${alex.accessToken}`)
        .send({ title: 'Dune (édition collector)' });
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.title).toBe('Dune (édition collector)');

      const archiveResponse = await request(server())
        .delete(`/api/v1/households/${householdId}/items/${itemId}`)
        .set('Authorization', `Bearer ${alex.accessToken}`);
      expect(archiveResponse.status).toBe(200);
      expect(archiveResponse.body.archivedAt).not.toBeNull();

      const listActive = await request(server())
        .get(`/api/v1/households/${householdId}/items`)
        .set('Authorization', `Bearer ${alex.accessToken}`);
      expect(listActive.body.data).toHaveLength(0);

      const listArchived = await request(server())
        .get(`/api/v1/households/${householdId}/items?archived=true`)
        .set('Authorization', `Bearer ${alex.accessToken}`);
      expect(listArchived.body.data).toHaveLength(1);

      const restoreResponse = await request(server())
        .post(`/api/v1/households/${householdId}/items/${itemId}/restore`)
        .set('Authorization', `Bearer ${alex.accessToken}`);
      expect(restoreResponse.status).toBe(201);
      expect(restoreResponse.body.archivedAt).toBeNull();

      // Un item doit toujours avoir au moins un propriétaire.
      const emptyOwners = await request(server())
        .patch(`/api/v1/households/${householdId}/items/${itemId}`)
        .set('Authorization', `Bearer ${alex.accessToken}`)
        .send({ ownerIds: [] });
      expect(emptyOwners.status).toBe(400);
    });
  });

  describe('critical: household isolation (docs/NOTRE_NID_PRD.md section 15)', () => {
    it('never lets a member of household A read, modify or delete an item of household B', async () => {
      const alex = await registerUser('iso-alex');
      const householdA = await createHousehold(alex.accessToken, 'Foyer A');
      const categoryA = await createCategory(alex.accessToken, householdA, 'CatA');
      const itemA = await createItem(
        alex.accessToken,
        householdA,
        categoryA,
        [alex.id],
        'Secret A',
      );

      const bob = await registerUser('iso-bob');
      const householdB = await createHousehold(bob.accessToken, 'Foyer B');

      // Bob ne peut même pas savoir que le household A existe.
      const directHouseholdAccess = await request(server())
        .get(`/api/v1/households/${householdA}`)
        .set('Authorization', `Bearer ${bob.accessToken}`);
      expect(directHouseholdAccess.status).toBe(403);

      // Lecture d'un item d'un autre household via SON PROPRE household : jamais trouvé.
      const readAttempt = await request(server())
        .get(`/api/v1/households/${householdB}/items/${itemA}`)
        .set('Authorization', `Bearer ${bob.accessToken}`);
      expect(readAttempt.status).toBe(404);

      const updateAttempt = await request(server())
        .patch(`/api/v1/households/${householdB}/items/${itemA}`)
        .set('Authorization', `Bearer ${bob.accessToken}`)
        .send({ title: 'Piraté' });
      expect(updateAttempt.status).toBe(404);

      const archiveAttempt = await request(server())
        .delete(`/api/v1/households/${householdB}/items/${itemA}`)
        .set('Authorization', `Bearer ${bob.accessToken}`);
      expect(archiveAttempt.status).toBe(404);

      // Même en essayant de passer par le household A directement (dont Bob n'est pas membre).
      const readViaHouseholdA = await request(server())
        .get(`/api/v1/households/${householdA}/items/${itemA}`)
        .set('Authorization', `Bearer ${bob.accessToken}`);
      expect(readViaHouseholdA.status).toBe(403);

      // L'item original est resté intact.
      const verifyIntact = await request(server())
        .get(`/api/v1/households/${householdA}/items/${itemA}`)
        .set('Authorization', `Bearer ${alex.accessToken}`);
      expect(verifyIntact.status).toBe(200);
      expect(verifyIntact.body.title).toBe('Secret A');
      expect(verifyIntact.body.archivedAt).toBeNull();
    });

    it('rejects owners that are not members of the target household', async () => {
      const alex = await registerUser('iso-owner-alex');
      const outsider = await registerUser('iso-owner-outsider');
      const householdId = await createHousehold(alex.accessToken, 'Foyer propriétaires');
      const categoryId = await createCategory(alex.accessToken, householdId, 'Cat');

      const response = await request(server())
        .post(`/api/v1/households/${householdId}/items`)
        .set('Authorization', `Bearer ${alex.accessToken}`)
        .send({ categoryId, title: 'Item', condition: 'GOOD', ownerIds: [outsider.id] });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('OWNERS_NOT_MEMBERS');
    });
  });

  describe('stats and exports', () => {
    it('returns coherent stats and export payloads', async () => {
      const alex = await registerUser('stats-alex');
      const householdId = await createHousehold(alex.accessToken, 'Foyer stats');
      const categoryId = await createCategory(alex.accessToken, householdId, 'Cat');
      await createItem(alex.accessToken, householdId, categoryId, [alex.id], 'Item stats');

      const stats = await request(server())
        .get(`/api/v1/households/${householdId}/stats`)
        .set('Authorization', `Bearer ${alex.accessToken}`);
      expect(stats.status).toBe(200);
      expect(stats.body.totalActiveItems).toBe(1);

      const exportJson = await request(server())
        .get(`/api/v1/households/${householdId}/exports/json`)
        .set('Authorization', `Bearer ${alex.accessToken}`);
      expect(exportJson.status).toBe(200);
      expect(exportJson.body).toHaveLength(1);

      const exportCsv = await request(server())
        .get(`/api/v1/households/${householdId}/exports/csv`)
        .set('Authorization', `Bearer ${alex.accessToken}`);
      expect(exportCsv.status).toBe(200);
      expect(exportCsv.text).toContain('Item stats');
    });
  });
});
