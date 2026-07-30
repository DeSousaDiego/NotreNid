import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { AuthService } from './auth.service';
import type { AppException } from '../common/exceptions/app-exception';
import type { PrismaService } from '../prisma/prisma.service';

const CONFIG: Record<string, string> = {
  JWT_ACCESS_SECRET: 'access-secret',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_SECRET: 'refresh-secret',
  JWT_REFRESH_TTL: '30d',
};

describe('AuthService', () => {
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; findUniqueOrThrow: jest.Mock };
    refreshSession: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let jwtService: { signAsync: jest.Mock };
  let configService: ConfigService;
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn(), findUniqueOrThrow: jest.fn() },
      refreshSession: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed-jwt') };
    configService = { getOrThrow: (key: string) => CONFIG[key] } as unknown as ConfigService;
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      configService,
    );
  });

  describe('register', () => {
    it('rejects an email that is already used', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({ email: 'a@a.com', password: 'password123', displayName: 'A' }),
      ).rejects.toMatchObject<Partial<AppException>>({ code: 'EMAIL_ALREADY_USED' });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('normalizes the email and hashes the password', async () => {
      let createdUser: { id: string; email: string; passwordHash: string } | undefined;
      prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }) => {
        createdUser = {
          id: 'u1',
          email: data.email,
          passwordHash: data.passwordHash,
        };
        return Promise.resolve({
          ...createdUser,
          displayName: data.displayName,
          avatarUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });
      prisma.user.findUniqueOrThrow.mockImplementation(() => Promise.resolve(createdUser));

      const result = await service.register({
        email: '  Alex@Example.com  ',
        password: 'password123',
        displayName: 'Alex',
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: 'alex@example.com' }) }),
      );
      const createdArgs = prisma.user.create.mock.calls[0][0].data;
      expect(await argon2.verify(createdArgs.passwordHash, 'password123')).toBe(true);
      expect(result.accessToken).toBe('signed-jwt');
      expect(result.refreshToken).toHaveLength(96);
    });
  });

  describe('login', () => {
    it('rejects an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toMatchObject<Partial<AppException>>({ code: 'INVALID_CREDENTIALS' });
    });

    it('rejects an incorrect password', async () => {
      const passwordHash = await argon2.hash('correct-password');
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@a.com',
        passwordHash,
      });

      await expect(
        service.login({ email: 'a@a.com', password: 'wrong-password' }),
      ).rejects.toMatchObject<Partial<AppException>>({ code: 'INVALID_CREDENTIALS' });
    });

    it('accepts a correct password and issues tokens', async () => {
      const passwordHash = await argon2.hash('correct-password');
      const user = {
        id: 'u1',
        email: 'a@a.com',
        passwordHash,
        avatarUrl: null,
        displayName: 'A',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.findUniqueOrThrow.mockResolvedValue(user);

      const result = await service.login({ email: 'a@a.com', password: 'correct-password' });
      expect(result.accessToken).toBe('signed-jwt');
      expect(prisma.refreshSession.create).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('rejects an unknown refresh token', async () => {
      prisma.refreshSession.findUnique.mockResolvedValue(null);

      await expect(service.refresh('does-not-exist')).rejects.toMatchObject<Partial<AppException>>({
        code: 'INVALID_REFRESH_TOKEN',
      });
    });

    it('rejects a revoked refresh token', async () => {
      prisma.refreshSession.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(service.refresh('revoked-token')).rejects.toMatchObject<Partial<AppException>>({
        code: 'INVALID_REFRESH_TOKEN',
      });
    });

    it('rejects an expired refresh token', async () => {
      prisma.refreshSession.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh('expired-token')).rejects.toMatchObject<Partial<AppException>>({
        code: 'INVALID_REFRESH_TOKEN',
      });
    });

    it('rotates a valid refresh token: revokes the old session and issues a new one', async () => {
      const user = {
        id: 'u1',
        email: 'a@a.com',
        avatarUrl: null,
        displayName: 'A',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.refreshSession.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
        deviceName: null,
      });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.findUniqueOrThrow.mockResolvedValue(user);

      await service.refresh('valid-token');

      expect(prisma.refreshSession.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      });
      expect(prisma.refreshSession.create).toHaveBeenCalled();
    });
  });
});
