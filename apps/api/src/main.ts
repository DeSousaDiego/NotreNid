import path from 'node:path';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppLogger } from './common/logger/app-logger.service';
import { buildOpenApiDocument } from './common/swagger/document';

const API_PREFIX = 'api/v1';
// Les images passent par l'upload multipart dédié (limite propre de 10 Mo, voir
// UploadsModule) : le corps JSON/urlencoded n'a besoin de contenir que des
// métadonnées textuelles, jamais de fichier binaire.
const JSON_BODY_LIMIT = '1mb';

async function bootstrap(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new AppLogger(isProduction),
  });
  const configService = app.get(ConfigService);

  app.use(helmet());
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: JSON_BODY_LIMIT, extended: true });

  // Stockage local des images (Phase 1/2) : servi hors préfixe /api pour des URLs simples.
  app.useStaticAssets(path.resolve(process.cwd(), 'storage', 'uploads'), {
    prefix: '/uploads',
  });

  app.setGlobalPrefix(API_PREFIX);

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigins = (configService.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
  });

  if (configService.get<string>('NODE_ENV') !== 'production') {
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, buildOpenApiDocument(app));
  }

  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
