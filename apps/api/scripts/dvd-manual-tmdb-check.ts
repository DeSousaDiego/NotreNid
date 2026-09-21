import path from 'node:path';

import type { ConfigService } from '@nestjs/config';
import { config as loadDotenv } from 'dotenv';

import { BarcodeCacheService } from '../src/items/barcode/barcode-cache.service';
import { DvdBarcodeResolverService } from '../src/items/barcode/dvd-barcode-resolver.service';
import { DvdEnrichmentService } from '../src/items/barcode/dvd-enrichment.service';
import { TmdbRateLimiterService } from '../src/items/barcode/providers/tmdb-rate-limiter.service';
import { TmdbProvider } from '../src/items/barcode/providers/tmdb.provider';
import type { UpcItemDbProvider } from '../src/items/barcode/providers/upcitemdb.provider';
import {
  AVATAR_BARCODE,
  AVATAR_FIXTURE,
  DARK_KNIGHT_TRILOGY_BARCODE,
  DARK_KNIGHT_TRILOGY_FIXTURE,
  NINE_BLURAY_BARCODE,
  NINE_BLURAY_FIXTURE,
  parseUpcItemDbFixture,
  PIRATES_BARCODE,
  PIRATES_FIXTURE,
  type RawUpcItemDbResponseFixture,
} from '../src/items/barcode/test-fixtures/upcitemdb';

/**
 * Script MANUEL uniquement — jamais exécuté en CI (voir `apps/api/jest.config.js`,
 * `rootDir: 'src'` : ce fichier, sous `apps/api/scripts/`, est hors de portée
 * de `testRegex`). Injecte une fixture UPCitemdb déjà capturée (voir
 * `src/items/barcode/test-fixtures/upcitemdb/`) puis appelle RÉELLEMENT
 * `api.themoviedb.org` avec `TMDB_READ_ACCESS_TOKEN` — sert à vérifier le
 * pipeline complet face à un TMDB réel, sans jamais consommer le quota
 * UPCitemdb (100/jour). N'appelle JAMAIS UPCitemdb : le provider est
 * intégralement remplacé par la fixture.
 *
 * Usage : voir `apps/api/package.json` (`dvd:manual-tmdb-check`) ou
 * directement `pnpm --filter @notre-nid/api exec ts-node -P tsconfig.json
 * scripts/dvd-manual-tmdb-check.ts <fixture>`, `<fixture>` étant une des clés
 * de `FIXTURES` ci-dessous (`nine` par défaut).
 */

loadDotenv({ path: path.resolve(process.cwd(), '../../.env') });

const FIXTURES: Record<string, { barcode: string; fixture: RawUpcItemDbResponseFixture }> = {
  nine: { barcode: NINE_BLURAY_BARCODE, fixture: NINE_BLURAY_FIXTURE },
  'dark-knight-trilogy': {
    barcode: DARK_KNIGHT_TRILOGY_BARCODE,
    fixture: DARK_KNIGHT_TRILOGY_FIXTURE,
  },
  pirates: { barcode: PIRATES_BARCODE, fixture: PIRATES_FIXTURE },
  avatar: { barcode: AVATAR_BARCODE, fixture: AVATAR_FIXTURE },
};

/** `ConfigService.get` réel n'effectue aucune conversion de type — un `.env`
 * contient toujours des chaînes. Les providers utilisent `.get<number>(...)`
 * par convention TypeScript uniquement ; ce fake convertit les valeurs
 * purement numériques pour rester correct à l'exécution (ex.
 * `TMDB_TIMEOUT_BUDGET_MS`), sans quoi `Date.now() + "8000"` produirait une
 * concaténation de chaînes plutôt qu'une addition. */
function fakeConfigService(): ConfigService {
  return {
    get: (key: string) => {
      const raw = process.env[key];
      if (raw === undefined) return undefined;
      return /^\d+$/.test(raw) ? Number(raw) : raw;
    },
  } as unknown as ConfigService;
}

/** Remplace intégralement `UpcItemDbProvider` — ne fait jamais de requête
 * réseau, renvoie toujours la fixture injectée. Toute autre valeur de
 * barcode est un signe que ce script serait en train d'appeler UPCitemdb
 * pour de vrai : traité comme une erreur de programmation, jamais silencié. */
function fixtureOnlyUpcItemDb(
  barcode: string,
  outcome: ReturnType<typeof parseUpcItemDbFixture>,
): UpcItemDbProvider {
  return {
    id: 'upcitemdb',
    lookup: async (requested: string) => {
      if (requested !== barcode) {
        throw new Error(
          `Ce script ne doit jamais interroger UPCitemdb réellement — barcode inattendu reçu : ${requested}.`,
        );
      }
      return outcome;
    },
  } as unknown as UpcItemDbProvider;
}

async function main(): Promise<void> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) {
    console.error(
      "TMDB_READ_ACCESS_TOKEN est absent de l'environnement (voir .env.example). " +
        'Ce script refuse de continuer sans lui — aucun appel TMDB réel ne doit jamais être tenté sans token explicite.',
    );
    process.exitCode = 1;
    return;
  }

  const key = process.argv[2] ?? 'nine';
  const entry = FIXTURES[key];
  if (!entry) {
    console.error(
      `Fixture inconnue "${key}". Valeurs possibles : ${Object.keys(FIXTURES).join(', ')}.`,
    );
    process.exitCode = 1;
    return;
  }

  const upcOutcome = parseUpcItemDbFixture(entry.fixture, entry.barcode);
  // eslint-disable-next-line no-console -- sortie CLI du script, pas un log applicatif
  console.log(
    `Fixture UPCitemdb "${key}" (barcode ${entry.barcode}) — statut interne UPC : ${upcOutcome.status}`,
  );

  const tmdb = new TmdbProvider(fakeConfigService(), new TmdbRateLimiterService());
  const enrichment = new DvdEnrichmentService(tmdb);
  const resolver = new DvdBarcodeResolverService(
    fixtureOnlyUpcItemDb(entry.barcode, upcOutcome),
    enrichment,
    new BarcodeCacheService(),
  );

  // eslint-disable-next-line no-console -- sortie CLI du script, pas un log applicatif
  console.log('Appel TMDB réel en cours (api.themoviedb.org)...\n');
  const response = await resolver.resolve(entry.barcode);

  // eslint-disable-next-line no-console -- sortie CLI du script, pas un log applicatif
  console.log('Résultat public normalisé :\n');
  // eslint-disable-next-line no-console -- sortie CLI du script, pas un log applicatif
  console.log(JSON.stringify(response, null, 2));
}

main().catch((error: unknown) => {
  console.error('Échec du test manuel TMDB :', error);
  process.exitCode = 1;
});
