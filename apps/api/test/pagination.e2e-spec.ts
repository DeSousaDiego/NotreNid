import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

// Fichier e2e dédié (son propre ThrottlerStorage en mémoire, comme rate-limiting.e2e-spec.ts) :
// ajoutés à households-items.e2e-spec.ts, ces scénarios dépassaient la limite d'inscriptions.
describe('Stable pagination (e2e, Release 0B)', () => {
  let app: INestApplication;
  let accessToken: string;
  let userId: string;

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

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `e2e-pagination-${randomUUID()}@test.local`,
        password: 'password123',
        displayName: 'Pagination',
      })
      .expect(201);
    accessToken = response.body.accessToken as string;
    userId = response.body.user.id as string;
  });

  afterAll(async () => {
    await app.close();
  });

  const authed = (req: request.Test) => req.set('Authorization', `Bearer ${accessToken}`);

  it.each(['title', 'condition'])(
    'pages through items sharing the same %s value without repeating or skipping any',
    async (sort) => {
      const household = await authed(request(app.getHttpServer()).post('/api/v1/households'))
        .send({ name: `Foyer pagination ${sort}` })
        .expect(201);
      const householdId = household.body.id as string;
      const category = await authed(
        request(app.getHttpServer()).post(`/api/v1/households/${householdId}/categories`),
      )
        .send({ name: 'Vinyles' })
        .expect(201);

      const created = new Set<string>();
      for (let i = 0; i < 7; i += 1) {
        // Même titre et même état pour tous : seul le départage par id rend l'ordre stable.
        const item = await authed(
          request(app.getHttpServer()).post(`/api/v1/households/${householdId}/items`),
        )
          .send({
            categoryId: category.body.id,
            title: 'Même titre',
            condition: 'GOOD',
            ownerIds: [userId],
          })
          .expect(201);
        created.add(item.body.id as string);
      }

      const seen: string[] = [];
      for (let page = 1; page <= 3; page += 1) {
        const response = await authed(
          request(app.getHttpServer()).get(`/api/v1/households/${householdId}/items`),
        )
          .query({ sort, order: 'asc', page, pageSize: 3 })
          .expect(200);
        seen.push(...(response.body.data as { id: string }[]).map((item) => item.id));
      }

      expect(seen).toHaveLength(7);
      expect(new Set(seen)).toEqual(created);
    },
  );
});
