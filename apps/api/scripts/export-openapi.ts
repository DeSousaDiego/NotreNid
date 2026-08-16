import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { buildOpenApiDocument } from '../src/common/swagger/document';

const OUTPUT_PATH = path.resolve(process.cwd(), '../../docs/openapi.json');

/**
 * Fige le contrat OpenAPI courant dans docs/openapi.json — utilisé par
 * `packages/api-client` (génération de types) et par la CI pour détecter toute
 * dérive non commitée entre l'API et son contrat documenté.
 */
async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  const document = buildOpenApiDocument(app);
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(document, null, 2)}\n`, 'utf-8');
  await app.close();
  // eslint-disable-next-line no-console -- sortie CLI du script, pas un log applicatif
  console.log(`Contrat OpenAPI écrit dans ${OUTPUT_PATH}`);
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console -- sortie CLI du script, pas un log applicatif
  console.error("Échec de l'export du contrat OpenAPI :", error);
  process.exitCode = 1;
});
