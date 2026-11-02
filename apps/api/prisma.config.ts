import path from 'node:path';

import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

import {
  assertSafeDatabaseForDestructiveOperation,
  detectDestructivePrismaCommand,
} from './src/database-safety/database-safety';

// Le monorepo garde un unique .env à la racine (voir README). Résolu depuis __dirname (et
// non process.cwd()) : prisma.config.ts vit toujours directement sous apps/api, quel que
// soit le répertoire depuis lequel la commande Prisma est invoquée — même raisonnement que
// ConfigModule.forRoot() dans apps/api/src/app.module.ts.
loadEnv({ path: path.resolve(__dirname, '../../.env') });

// Ce fichier est chargé par CHAQUE commande du CLI Prisma : c'est le seul point qui protège
// aussi un `prisma migrate reset` tapé à la main, hors des scripts du dépôt (voir README,
// « Commandes destructives »). Les variables déjà présentes dans l'environnement priment
// sur le .env (dotenv n'écrase jamais) — c'est ainsi que scripts/db-safe.ts cible la base TEST.
const destructiveCommand = detectDestructivePrismaCommand(process.argv);
if (destructiveCommand) {
  assertSafeDatabaseForDestructiveOperation(destructiveCommand);
}

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
