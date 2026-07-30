import { createHmac, randomBytes } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { AppException } from '../common/exceptions/app-exception';
import { toPublicUser, type PublicUser } from '../common/mappers/public-user.mapper';
import { parseDurationToMs } from '../common/utils/duration';
import { normalizeEmail } from '../common/utils/normalize-email';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'EMAIL_ALREADY_USED',
        'Cet email est déjà utilisé.',
      );
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, displayName: dto.displayName },
    });

    return this.issueTokens(user.id, user.email, undefined);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Email ou mot de passe incorrect.',
      );
    }

    return this.issueTokens(user.id, user.email, dto.deviceName);
  }

  async refresh(rawRefreshToken: string): Promise<AuthResult> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const session = await this.prisma.refreshSession.findUnique({ where: { tokenHash } });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_REFRESH_TOKEN',
        'Session invalide, veuillez vous reconnecter.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_REFRESH_TOKEN',
        'Session invalide, veuillez vous reconnecter.',
      );
    }

    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(user.id, user.email, session.deviceName ?? undefined);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Utilisateur introuvable.');
    }
    return toPublicUser(user);
  }

  private async issueTokens(
    userId: string,
    email: string,
    deviceName: string | undefined,
  ): Promise<AuthResult> {
    const accessTtlSeconds = Math.floor(
      parseDurationToMs(this.configService.getOrThrow<string>('JWT_ACCESS_TTL')) / 1000,
    );
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessTtlSeconds,
      },
    );

    const rawRefreshToken = randomBytes(48).toString('hex');
    const refreshTtlMs = parseDurationToMs(
      this.configService.getOrThrow<string>('JWT_REFRESH_TTL'),
    );

    await this.prisma.refreshSession.create({
      data: {
        userId,
        tokenHash: this.hashRefreshToken(rawRefreshToken),
        deviceName,
        expiresAt: new Date(Date.now() + refreshTtlMs),
      },
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    return { user: toPublicUser(user), accessToken, refreshToken: rawRefreshToken };
  }

  private hashRefreshToken(rawToken: string): string {
    const secret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    return createHmac('sha256', secret).update(rawToken).digest('hex');
  }
}
