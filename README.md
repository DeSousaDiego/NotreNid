# Notre Nid

Application mobile de gestion de collection partagée pour un couple (livres, CD, DVD, catégories personnalisables). Cahier des charges complet : [docs/NOTRE_NID_PRD.md](docs/NOTRE_NID_PRD.md).

## Statut du projet

**Phase 1 — Fondation** est terminée et validée (lint, typecheck, tests, builds). Aucune fonctionnalité métier (authentification, households, items, ...) n'est encore implémentée : voir [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) pour les phases suivantes et [docs/PHASE_STATUS.md](docs/PHASE_STATUS.md) pour le détail de l'état actuel.

Ce qui existe aujourd'hui :

- un monorepo pnpm fonctionnel (`apps/*`, `packages/*`) ;
- une API NestJS qui démarre et expose `GET /api/v1/health` et `GET /api/v1/health/ready` ;
- Prisma configuré (schéma + client généré), sans modèle de données ni migration (Phase 2) ;
- une application mobile Expo (Expo Router, TypeScript strict) avec un unique écran de bienvenue ;
- deux packages partagés (`shared`, `api-client`) à l'état de squelette ;
- un environnement Docker local (PostgreSQL, Mailpit, MinIO optionnel).

Aucune authentification, aucun household, aucun item, aucune image et aucune donnée métier ne sont encore implémentés.

## Stack

- **Mobile** : Expo (SDK 57), Expo Router, React Native, TypeScript strict, TanStack Query et React Hook Form (prévus Phase 3).
- **API** : Node.js LTS, NestJS 11, REST, class-validator, JWT (prévu Phase 2), Argon2 (prévu Phase 2).
- **Base de données** : PostgreSQL 16, Prisma ORM.
- **Stockage** : abstraction locale en développement, S3-compatible/Supabase Storage prévu en production (Phase 2+).
- **Tests** : Jest (unitaire + e2e côté API via Supertest).
- **CI** : à mettre en place en Phase 4.

## Pré-requis

- Node.js 22 LTS
- pnpm ≥ 11 (`corepack enable` ou `npm install -g pnpm`)
- Docker Desktop (PostgreSQL, Mailpit, MinIO en local)
- Expo Go (mobile) ou un simulateur iOS / émulateur Android

## Installation locale

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:generate
pnpm dev:api      # démarre l'API sur http://localhost:3000
pnpm dev:mobile   # démarre Expo (Metro / Expo Dev Tools)
```

> Les migrations Prisma (`pnpm --filter @notre-nid/api exec prisma migrate dev`) et le seed de données arrivent en Phase 2 : le schéma actuel ne contient aucun modèle.

## Variables d'environnement

Voir [.env.example](.env.example) pour la liste complète et commentée. Points clés :

- `DATABASE_URL` : connexion PostgreSQL (doit correspondre aux identifiants de `docker-compose.yml` en local).
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` : secrets de développement uniquement — à régénérer avant toute mise en production.
- `MOBILE_PUBLIC_API_URL` : seule variable destinée à être embarquée dans le bundle mobile ; ne doit jamais contenir de secret.
- `STORAGE_*` : configuration du stockage d'images (non utilisée avant l'implémentation des uploads, Phase 2).

## Base de données

- Schéma : [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma) (datasource + generator uniquement pour l'instant).
- Générer le client Prisma : `pnpm db:generate`.
- Migrations, seed et Prisma Studio : prévus Phase 2, une fois le modèle de données défini.

## Lancement

```bash
docker compose up -d              # PostgreSQL + Mailpit (+ MinIO via --profile storage)
pnpm dev:api                      # API NestJS (http://localhost:3000/api/v1/health)
pnpm dev:mobile                   # Application mobile (Expo)
pnpm test                         # Tests (tous les packages qui en définissent)
```

## Comptes de démonstration

Aucun compte de démonstration n'existe encore : ils seront créés par le script de seed en Phase 2 (développement uniquement, jamais en production).

## Architecture du dépôt

```text
apps/
  api/            NestJS — API REST (/api/v1), Prisma, Swagger en développement
  mobile/         Expo Router — application mobile TypeScript strict
packages/
  shared/         Types et constantes partagés entre l'API et le mobile
  api-client/      Client HTTP typé consommé par le mobile (squelette)
  config/          tsconfig de base partagé
  eslint-config/    Configuration ESLint (flat config) partagée
docs/              Documentation (PRD, plan d'implémentation, statut des phases, ...)
docker-compose.yml  PostgreSQL, Mailpit, MinIO (profil optionnel)
```

## Scripts disponibles (racine)

| Commande | Description |
| --- | --- |
| `pnpm install` | Installe toutes les dépendances du monorepo |
| `pnpm dev:api` | Démarre l'API en mode watch |
| `pnpm dev:mobile` | Démarre Expo (Metro) |
| `pnpm build` | Build tous les packages/apps qui définissent un script `build` |
| `pnpm lint` / `pnpm lint:fix` | Lint (ESLint flat config) sur tout le monorepo |
| `pnpm format` / `pnpm format:check` | Formatage Prettier |
| `pnpm typecheck` | Vérification TypeScript stricte sur tout le monorepo |
| `pnpm test` | Tests (packages qui en définissent) |
| `pnpm db:generate` | Génère le client Prisma |

## Tests

```bash
pnpm --filter @notre-nid/api run test       # tests unitaires (Jest)
pnpm --filter @notre-nid/api run test:e2e   # tests d'intégration (Supertest)
```

Aucun test métier n'existe encore (authentification, isolation des households, ...) : ils seront ajoutés au fur et à mesure de la Phase 2, conformément à la règle du dépôt imposant des tests pour toute modification des permissions ou de l'authentification.

## Déploiement

Non applicable à ce stade (Phase 5). Aucun déploiement, migration de production ou opération destructive n'est effectué sans autorisation explicite du propriétaire du dépôt.

## Génération mobile

Non applicable à ce stade (Phase 5, voir `docs/MOBILE_RELEASE.md` à venir).

## Sécurité

- `helmet`, un préfixe d'API versionné (`/api/v1`) et une validation globale des DTO (`whitelist`, `forbidNonWhitelisted`) sont déjà en place dans l'API.
- Authentification, hachage Argon2, JWT et isolation stricte des households arrivent en Phase 2. `SECURITY.md` sera créé à ce moment-là ; les règles permanentes en vigueur sont dans [CLAUDE.md](CLAUDE.md).
- Aucun secret réel n'est commité ; `.env.example` ne contient que des valeurs de développement explicitement fictives.

## Sauvegardes

Non applicable à ce stade (Phase 5, voir `docs/BACKUP_AND_RESTORE.md` à venir) — aucune donnée métier n'existe encore.

## Limitations connues

- Aucun modèle de données Prisma, aucune migration, aucun seed.
- Aucune authentification, aucune gestion de households, d'items ou d'images.
- Aucun test métier, aucune CI, aucun packaging mobile installable.
- Le thème visuel complet (tokens de couleur, typographie) et la navigation à cinq destinations ne sont pas encore implémentés côté mobile.
- `docker compose up -d` n'a pas pu être exécuté dans l'environnement d'implémentation (Docker non détecté dans la session shell) : à valider par le propriétaire du dépôt.

## Roadmap

Voir la section « Roadmap future » de [docs/NOTRE_NID_PRD.md](docs/NOTRE_NID_PRD.md#27-roadmap-future) (scan ISBN, wishlist, prêts, tags, mode offline-first, etc.) et [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) pour les phases 2 à 5.
