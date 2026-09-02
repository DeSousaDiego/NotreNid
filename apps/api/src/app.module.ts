import path from 'node:path';

import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { CommonModule } from './common/common.module';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ExportsModule } from './exports/exports.module';
import { HealthModule } from './health/health.module';
import { HouseholdsModule } from './households/households.module';
import { InvitationsModule } from './invitations/invitations.module';
import { ItemsModule } from './items/items.module';
import { PrismaModule } from './prisma/prisma.module';
import { StatsModule } from './stats/stats.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

// Le monorepo garde un unique .env à la racine (voir README). Résolu depuis __dirname (et
// non process.cwd()) : dist/app.module.js vit toujours à la même profondeur sous apps/api,
// quel que soit le répertoire depuis lequel le processus est lancé (pnpm --filter, nest
// start, `node apps/api/dist/main.js` depuis la racine, ou toute autre invocation). Sans
// secret réel à charger en production (pas de .env dans l'image Docker/l'hébergeur), un
// chemin qui ne résout aucun fichier ne casse rien : ConfigModule retombe sur process.env.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, '../../../.env'),
    }),
    // Limite globale par défaut, appliquée à toutes les routes non couvertes par un
    // @Throttle() plus spécifique (voir AuthController pour les limites renforcées).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
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
    UsersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
