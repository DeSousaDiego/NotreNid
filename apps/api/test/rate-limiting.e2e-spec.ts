import { randomUUID } from 'node:crypto';

import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { applyTrustProxy } from '../src/common/http/trust-proxy';

// Fichier e2e dédié (donc son propre ThrottlerStorage en mémoire) pour ne pas
// interférer avec les compteurs des autres suites e2e qui utilisent aussi
// /auth/login et /auth/register.
describe('Rate limiting (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    // Comme en production derrière Render (main.ts) : un proxy de confiance. Ici, supertest
    // joue le rôle du proxy : l'en-tête X-Forwarded-For envoyé est « ce que Render ajoute ».
    applyTrustProxy(app, 1);
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

  it('counts each client separately behind the trusted proxy, and ignores a spoofed left-most entry', async () => {
    const clientA = '203.0.113.10';
    const clientB = '203.0.113.20';
    const login = (forwardedFor: string) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', forwardedFor)
        .send({ email: `e2e-proxy-${randomUUID()}@test.local`, password: 'wrong-password' });

    for (let i = 0; i < 10; i += 1) {
      expect((await login(clientA)).status).toBe(401);
    }
    expect((await login(clientA)).status).toBe(429);

    // Un autre client derrière le même proxy n'est pas bloqué par le quota de A…
    expect((await login(clientB)).status).toBe(401);
    // … et A ne contourne pas son quota en préfixant une fausse IP : seule l'entrée ajoutée
    // par le proxy de confiance (la plus à droite) compte.
    expect((await login(`198.51.100.99, ${clientA}`)).status).toBe(429);
  });

  it('gives /auth/refresh its own, wider limit than login (automatic client operation)', async () => {
    const refresh = () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Forwarded-For', '203.0.113.30')
        .send({ refreshToken: 'not-a-valid-refresh-token' });

    const statuses: number[] = [];
    for (let i = 0; i < 31; i += 1) {
      statuses.push((await refresh()).status);
    }

    // Plus de 10 refresh/min tolérés (la limite de connexion aurait bloqué dès le 11e)…
    expect(statuses.slice(0, 30).every((status) => status === 401)).toBe(true);
    // … mais la protection contre l'abus reste active.
    expect(statuses[30]).toBe(429);
  });
});
