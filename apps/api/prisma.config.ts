import path from 'node:path';

import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Le monorepo garde un unique .env à la racine (voir README). Résolu depuis __dirname (et
// non process.cwd()) : prisma.config.ts vit toujours directement sous apps/api, quel que
// soit le répertoire depuis lequel la commande Prisma est invoquée — même raisonnement que
// ConfigModule.forRoot() dans apps/api/src/app.module.ts.
loadEnv({ path: path.resolve(__dirname, '../../.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
