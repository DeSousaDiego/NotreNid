import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Auth (e2e)', () => {
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

  function uniqueEmail(): string {
    return `e2e-auth-${randomUUID()}@test.local`;
  }

  it('registers a new user and returns tokens', async () => {
    const email = uniqueEmail();
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123', displayName: 'E2E User' });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe(email);
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(typeof response.body.accessToken).toBe('string');
    expect(typeof response.body.refreshToken).toBe('string');
  });

  it('refuses to register the same email twice', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123', displayName: 'E2E User' });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123', displayName: 'E2E User' });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EMAIL_ALREADY_USED');
    expect(response.body.requestId).toBeDefined();
  });

  it('rejects login with a wrong password', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123', displayName: 'E2E User' });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects a malformed registration payload with the standard validation error shape', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'short', displayName: '' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(response.body.details)).toBe(true);
    expect(response.body.details.length).toBeGreaterThan(0);
  });

  it('supports the full login -> refresh -> logout -> refresh-fails cycle', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123', displayName: 'E2E User' });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'password123' });
    expect(login.status).toBe(200);

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken);

    // Le token de refresh initial est révoqué après rotation : il ne doit plus fonctionner.
    const reuseOldToken = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken });
    expect(reuseOldToken.status).toBe(401);
    expect(reuseOldToken.body.code).toBe('INVALID_REFRESH_TOKEN');

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: refreshed.body.refreshToken })
      .expect(204);

    const refreshAfterLogout = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: refreshed.body.refreshToken });
    expect(refreshAfterLogout.status).toBe(401);
  });

  it('protects /auth/me and returns the current user when authenticated', async () => {
    const email = uniqueEmail();
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123', displayName: 'E2E User' });

    const withoutToken = await request(app.getHttpServer()).get('/api/v1/auth/me');
    expect(withoutToken.status).toBe(401);

    const withToken = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${register.body.accessToken}`);
    expect(withToken.status).toBe(200);
    expect(withToken.body.email).toBe(email);
  });
});
