import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

// Fichier e2e dédié (donc son propre ThrottlerStorage en mémoire) pour ne pas
// interférer avec les compteurs des autres suites e2e qui utilisent aussi
// /auth/login et /auth/register.
describe('Rate limiting (e2e)', () => {
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

  it('throttles repeated /auth/login attempts with the standard error shape', async () => {
    const email = `e2e-throttle-${randomUUID()}@test.local`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123', displayName: 'E2E Throttle' });

    const attempt = () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrong-password' });

    // La limite configurée sur /auth/login est de 10 requêtes/minute (voir
    // AuthController) : la 11e requête dans la même fenêtre doit être bloquée.
    const responses: Awaited<ReturnType<typeof attempt>>[] = [];
    for (let i = 0; i < 11; i += 1) {
      // Séquentiel et non parallèle : le compteur du throttler doit voir chaque
      // appel un par un, comme le ferait un vrai client.
      responses.push(await attempt());
    }

    const throttled = responses.at(-1);
    expect(throttled).toBeDefined();
    expect(throttled?.status).toBe(429);
    expect(throttled?.body.code).toBe('TOO_MANY_REQUESTS');
    expect(throttled?.body.requestId).toBeDefined();

    expect(responses.slice(0, 10).every((response) => response.status === 401)).toBe(true);
  });
});
