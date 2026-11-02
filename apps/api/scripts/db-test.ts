import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { assertSafeTestEnvironment, buildTestEnvironment } from '../test/test-environment';

/**
 * Prépare la base de TEST (jamais DEV ni PROD) — voir README, « Environnements ».
 *
 *   tsx scripts/db-test.ts migrate   → prisma migrate deploy sur la base de test
 *   tsx scripts/db-test.ts reset     → prisma migrate reset --force sur la base de test
 *
 * La cible vient de DATABASE_URL_TEST (jamais de DATABASE_URL) et est vérifiée par le
 * garde-fou commun AVANT de lancer Prisma ; prisma.config.ts la revérifie de son côté.
 */
const COMMANDS: Record<string, string[]> = {
  migrate: ['migrate', 'deploy'],
  reset: ['migrate', 'reset', '--force'],
};

const command = process.argv[2] ?? '';
const prismaArgs = COMMANDS[command];
if (!prismaArgs) {
  console.error(`Usage : tsx scripts/db-test.ts <${Object.keys(COMMANDS).join('|')}>`);
  process.exit(2);
}

const environment = buildTestEnvironment();
let target: string;
try {
  target = assertSafeTestEnvironment(`la préparation de la base de test (${command})`, environment);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

console.log(`Base de test : ${target} — prisma ${prismaArgs.join(' ')}`);
const result = spawnSync('pnpm', ['exec', 'prisma', ...prismaArgs], {
  cwd: path.resolve(__dirname, '..'),
  env: { ...process.env, ...environment },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
