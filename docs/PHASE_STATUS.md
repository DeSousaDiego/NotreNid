# Statut des phases — Notre Nid

## Phase courante

**Phase 1 — Fondation** : ✅ terminée et validée. Prochaine phase : **Phase 2 — Backend métier** (non démarrée).

## Éléments terminés (Phase 1)

- Correction d'une incohérence documentaire : `CLAUDE.md` importait `docs/NOTRE_NID_PRD.md`, un chemin inexistant. Le PRD (`docs/Notre_Nid_PRD_Prompt_Claude_Code.md`) a été renommé vers ce chemin (`git mv`) pour devenir la source de vérité réelle, sans duplication.
- Monorepo pnpm workspaces (`apps/*`, `packages/*`), sans Turborepo (jugé non nécessaire à ce stade).
- TypeScript strict partagé via `packages/config` (base commune) + configurations spécifiques par app.
- ESLint (flat config) et Prettier partagés via `packages/eslint-config`, avec un preset `node` (API, packages) et un preset `react-native` (mobile, basé sur `eslint-config-expo/flat`).
- `docker-compose.yml` : PostgreSQL 16, Mailpit ; MinIO optionnel derrière le profil `storage`.
- `.env.example` complet (toutes les variables de la section 13 du PRD), sans secret réel.
- API NestJS (`apps/api`) : bootstrap avec `helmet`, préfixe `/api/v1`, `ValidationPipe` global, CORS configurable, Swagger en développement (`/api/v1/docs`), module `health` (`GET /health`, `GET /health/ready`).
- Prisma initialisé (`apps/api/prisma/schema.prisma` + `prisma.config.ts`) : datasource et generator uniquement, **aucun modèle ni migration** (hors périmètre Phase 1).
- Application mobile Expo (`apps/mobile`) : squelette Expo Router + TypeScript strict, un unique écran de bienvenue. Le contenu de démonstration du template `create-expo-app` (tabs, écran "Explore", icônes animées, thème d'exemple) a été retiré pour ne pas laisser de fausses fonctionnalités.
- Packages partagés : `packages/shared` (types/constantes, squelette) et `packages/api-client` (client API typé, squelette) — tous deux buildables et importés correctement (`api-client` dépend de `shared` via `workspace:*`).

## Fichiers principaux créés ou modifiés

- Racine : `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `.editorconfig`, `.gitignore`, `.prettierrc.json`, `.prettierignore`, `.env.example`, `docker-compose.yml`, `README.md`, `CLAUDE.md`.
- `docs/NOTRE_NID_PRD.md` (renommé), `docs/IMPLEMENTATION_PLAN.md`, `docs/PHASE_STATUS.md` (nouveaux).
- `apps/api/**` (NestJS : `main.ts`, `app.module.ts`, module `health`, configuration Jest/ESLint/TypeScript, `prisma/schema.prisma`, `prisma.config.ts`).
- `apps/mobile/**` (Expo Router : `src/app/_layout.tsx`, `src/app/index.tsx`, `app.json`, configuration ESLint/TypeScript).
- `packages/shared/**`, `packages/api-client/**`, `packages/config/**`, `packages/eslint-config/**`.

## Migrations ajoutées

Aucune. Le schéma Prisma ne contient encore aucun modèle (prévu Phase 2).

## Commandes réellement exécutées et leur résultat

| Commande | Résultat |
| --- | --- |
| `pnpm install` | ✅ succès (1311 entrées de lockfile, build scripts approuvés pour `prisma`/`@prisma/engines`/`unrs-resolver`, refusés pour `@scarf/scarf` — télémétrie) |
| `pnpm --filter @notre-nid/api run db:generate` | ✅ succès — client Prisma généré |
| `pnpm -r --if-present run typecheck` | ✅ succès sur `apps/api`, `apps/mobile`, `packages/shared`, `packages/api-client` |
| `pnpm -r --if-present run lint` | ✅ succès (0 erreur, 0 warning) sur les 4 mêmes packages |
| `pnpm -r --if-present run test` | ✅ succès — `apps/api` : 2 suites, 4 tests (unitaire + e2e) |
| `pnpm --filter @notre-nid/api run test:e2e` | ✅ succès — 2 tests Supertest sur `/api/v1/health` et `/api/v1/health/ready` |
| `pnpm -r --if-present run build` | ✅ succès — `apps/api` (`nest build`), `packages/shared`, `packages/api-client` |
| `node dist/main.js` (apps/api) + `curl /api/v1/health`, `/api/v1/health/ready`, `/api/v1/docs` | ✅ succès — 200 sur les trois, réponses JSON correctes |
| `npx expo export --platform web` (apps/mobile) | ✅ succès — bundle Metro généré (823 modules), 3 routes statiques |
| `npx expo-doctor` (apps/mobile) | ✅ succès — 20/20 vérifications passées |
| `pnpm run format:check` puis `pnpm run format` | ⚠️ 19 fichiers non conformes détectés puis corrigés automatiquement ; `format:check` repasse au vert ensuite |
| `docker --version` / `docker compose version` (1ère vérification) | ❌ Docker introuvable dans la session shell d'implémentation |
| `docker --version` / `docker compose version` (2e vérification, nouvelle session) | ✅ CLI détecté (`docker 29.6.2`, `docker compose v5.3.1`) |
| `docker compose up -d` (1ère tentative) | ❌ échec : `failed to connect to the docker API at npipe:////./pipe/docker_engine` — le moteur ne répond pas |
| `wsl --status` (1ère vérification) | ❌ « Le Sous-système Windows pour Linux n'est pas installé » |
| `wsl --status` (après `wsl --install` + redémarrage par le propriétaire du dépôt) | ✅ WSL2 installé et actif |
| `docker compose up -d` (après relance de Docker Desktop) | ✅ succès — images `postgres:16-alpine` et `axllent/mailpit:latest` tirées, conteneurs créés et démarrés |
| `docker compose ps` | ✅ `notre-nid-postgres-1` et `notre-nid-mailpit-1` tous deux `Up ... (healthy)` |
| `docker compose exec postgres pg_isready -U notre_nid -d notre_nid` | ✅ `accepting connections` |
| `curl http://localhost:8025/` (Mailpit web UI) | ✅ 200 |
| Connexion Prisma réelle à la base (script ad hoc avec `@prisma/adapter-pg` + `pg`, retiré ensuite) | ✅ `SELECT 1` exécuté avec succès contre la base Dockerisée — voir « Découverte importante » ci-dessous |

## Problèmes connus (résolus)

- ~~Moteur Docker indisponible~~ **Résolu.** Cause : machine en **Windows 11 Home** sans **WSL2** installé (Hyper-V indisponible sur cette édition, seul backend possible pour Docker Desktop). Le propriétaire du dépôt a exécuté `wsl --install` puis redémarré la machine ; Docker Desktop a ensuite été relancé et le moteur a démarré normalement. `docker compose up -d` validé avec succès (voir tableau ci-dessus).

## Découverte importante pour la Phase 2

- **Prisma 7 (`prisma-client-js`) exige un adaptateur de driver explicite.** `new PrismaClient()` seul échoue désormais avec `PrismaClientInitializationError: ... A driver adapter is required to connect to your database.` (testé en conditions réelles contre le PostgreSQL Dockerisé). Il faudra donc, en Phase 2, ajouter `pg` et `@prisma/adapter-pg` comme dépendances de `apps/api` et instancier le `PrismaService` avec :
  ```ts
  import { PrismaPg } from '@prisma/adapter-pg';
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  ```
  Ces paquets ont été testés puis **retirés** de `apps/api/package.json` à la fin de cette vérification : ils ne sont pas utilisés par du code applicatif en Phase 1 (aucun `PrismaModule`/`PrismaService` n'existe encore), et les ajouter sans usage réel aurait été une dépendance inutile pour cette phase.
- Le générateur Prisma choisi reste `prisma-client-js` (classique, CommonJS) plutôt que le nouveau générateur `prisma-client` (qui émet du TypeScript ESM avec `import.meta`, incompatible avec le NestJS CommonJS/décorateurs de ce dépôt).
- TypeScript est fixé à `6.0.3` (et non la dernière version `7.0.2`) car `@typescript-eslint` ne supporte que `<6.1.0` à ce jour.

## Décisions prises

- Pas de Turborepo pour l'instant (pnpm workspaces suffisent pour 2 apps + 4 packages).
- `provider = "prisma-client-js"` pour Prisma (voir ci-dessus).
- ESLint fixé en version `9.39.5` : `eslint-plugin-import@2.32.0` (utilisé pour `import/order`) provoque un crash (`getTokenOrCommentBefore is not a function`) sous ESLint 10 lors du calcul d'un correctif de réordonnancement d'imports.
- `@scarf/scarf` (télémétrie d'installation, dépendance transitive de `unrs-resolver`) explicitement désactivé dans `pnpm-workspace.yaml` (`allowBuilds`).
- Contenu de démonstration du template Expo entièrement retiré (voir plus haut) plutôt que laissé partiellement fonctionnel.
- `@types/node` fixé sur la branche `22.x` pour correspondre à la version de Node.js réellement installée (22.18.0), plutôt que la dernière version publiée du paquet de types.

## Actions manuelles restantes

- Aucune. `docker compose up -d` est validé (PostgreSQL et Mailpit tous deux `healthy`) ; aucun compte tiers ni secret de production n'est requis pour la Phase 1.

## Prochaine étape recommandée

Démarrer la **Phase 2 — Backend métier** : modèle de données Prisma complet, première migration, seed, authentification, households, catégories, items, recherche, uploads, statistiques et exports (voir `docs/IMPLEMENTATION_PLAN.md`).
