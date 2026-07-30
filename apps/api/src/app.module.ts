import path from 'node:path';

import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { CommonModule } from './common/common.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ExportsModule } from './exports/exports.module';
import { HealthModule } from './health/health.module';
import { HouseholdsModule } from './households/households.module';
import { InvitationsModule } from './invitations/invitations.module';
import { ItemsModule } from './items/items.module';
import { PrismaModule } from './prisma/prisma.module';
import { StatsModule } from './stats/stats.module';
import { UploadsModule } from './uploads/uploads.module';

// Le monorepo garde un unique .env à la racine (voir README) : l'API est
// toujours démarrée avec process.cwd() = apps/api (pnpm --filter / nest start).
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(process.cwd(), '../../.env'),
    }),
    PrismaModule,
    CommonModule,
    HealthModule,
    AuthModule,
    HouseholdsModule,
    InvitationsModule,
    CategoriesModule,
    ItemsModule,
    UploadsModule,
    StatsModule,
    ExportsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
