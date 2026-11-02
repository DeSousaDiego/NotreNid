import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { assertDatabaseMatchesAppEnv } from '../database-safety/database-safety';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>('DATABASE_URL');
    // Refuse de démarrer si un processus non-production vise une base déclarée production.
    assertDatabaseMatchesAppEnv({
      APP_ENV: configService.get<string>('APP_ENV'),
      DATABASE_URL: connectionString,
      PRODUCTION_DATABASE_HOSTS: configService.get<string>('PRODUCTION_DATABASE_HOSTS'),
    });
    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
