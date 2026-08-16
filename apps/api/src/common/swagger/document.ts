import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';

/**
 * Contrat OpenAPI unique, partagé entre le bootstrap de l'API (Swagger UI en
 * développement, `main.ts`) et le script d'export (`scripts/export-openapi.ts`)
 * qui fige `docs/openapi.json` — pour éviter que les deux dérivent l'un de l'autre.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Notre Nid API')
    .setDescription('API de gestion de collection partagée pour Notre Nid.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}
