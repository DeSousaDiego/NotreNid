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
| `docker --version` / `docker compose version` | ❌ Docker introuvable dans la session shell d'implémentation (voir « Problèmes connus ») |

## Problèmes connus

- **Docker non détecté** : bien que le propriétaire du dépôt ait indiqué avoir installé Docker Desktop en cours de session, ni `docker` ni `docker compose` ne sont reconnus dans le shell (Bash ou PowerShell) utilisé pour l'implémentation. `docker compose up -d` n'a donc pas pu être exécuté ni validé. Cause probable : le terminal a été ouvert avant la fin de l'installation, ou le PATH n'a pas été rafraîchi. **Action à vérifier par le propriétaire** : ouvrir un nouveau terminal / une nouvelle session et exécuter `docker compose up -d`, puis confirmer que PostgreSQL et Mailpit démarrent correctement.
- Aucune connexion réelle à PostgreSQL n'a donc pu être testée (hors périmètre Phase 1 de toute façon : aucun modèle Prisma n'existe encore).
- Le générateur Prisma choisi est `prisma-client-js` (classique, CommonJS), et non le nouveau générateur `prisma-client` par défaut de Prisma 7 (qui émet du TypeScript ESM avec `import.meta`, incompatible avec le NestJS CommonJS/décorateurs de ce dépôt). Décision documentée pour rester cohérent avec la stack imposée par le PRD.
- TypeScript est fixé à `6.0.3` (et non la dernière version `7.0.2`) car `@typescript-eslint` ne supporte que `<6.1.0` à ce jour.

## Décisions prises

- Pas de Turborepo pour l'instant (pnpm workspaces suffisent pour 2 apps + 4 packages).
- `provider = "prisma-client-js"` pour Prisma (voir ci-dessus).
- ESLint fixé en version `9.39.5` : `eslint-plugin-import@2.32.0` (utilisé pour `import/order`) provoque un crash (`getTokenOrCommentBefore is not a function`) sous ESLint 10 lors du calcul d'un correctif de réordonnancement d'imports.
- `@scarf/scarf` (télémétrie d'installation, dépendance transitive de `unrs-resolver`) explicitement désactivé dans `pnpm-workspace.yaml` (`allowBuilds`).
- Contenu de démonstration du template Expo entièrement retiré (voir plus haut) plutôt que laissé partiellement fonctionnel.
- `@types/node` fixé sur la branche `22.x` pour correspondre à la version de Node.js réellement installée (22.18.0), plutôt que la dernière version publiée du paquet de types.

## Actions manuelles restantes

- Confirmer que Docker Desktop est bien opérationnel dans un terminal frais, puis exécuter `docker compose up -d` et vérifier que PostgreSQL (`5432`) et Mailpit (`8025`) répondent.
- Aucune autre action externe n'est requise pour la Phase 1 (aucun compte tiers, aucun secret de production nécessaire à ce stade).

## Prochaine étape recommandée

Démarrer la **Phase 2 — Backend métier** : modèle de données Prisma complet, première migration, seed, authentification, households, catégories, items, recherche, uploads, statistiques et exports (voir `docs/IMPLEMENTATION_PLAN.md`).
