# Contribuer à Notre Nid

Projet personnel développé phase par phase avec Claude Code, conformément à `CLAUDE.md` et `docs/NOTRE_NID_PRD.md` (source de vérité fonctionnelle et technique). Ce document explique les conventions à suivre pour toute contribution, humaine ou assistée.

## Prérequis

Voir la section « Pré-requis » du [README](README.md) : Node.js 22 LTS, pnpm ≥ 11, Docker Desktop, Expo Go ou un simulateur/émulateur.

## Installation

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:generate
pnpm --filter @notre-nid/api exec prisma migrate dev
pnpm --filter @notre-nid/api run db:seed
```

## Style de code

- TypeScript strict partout (`packages/config/tsconfig.base.json`) — pas de `any` non justifié.
- ESLint (flat config, `packages/eslint-config`) et Prettier appliqués automatiquement via Husky + lint-staged à chaque commit.
- Tri des imports imposé par ESLint (`import/order`) — laisser `--fix` corriger l'ordre plutôt que le faire manuellement.
- Commentaires uniquement pour expliquer une décision non évidente (contrainte cachée, contournement d'un bug précis) — jamais pour décrire ce que fait déjà un code lisible.

## Convention de commits

Préfixe court indiquant la nature du changement, suivi d'une description concise à l'impératif :

```text
feat(api): ajoute la route de statistiques par household
fix(mobile): corrige le rendu de la liste vide
docs: met à jour le guide de déploiement
chore: met à jour une dépendance
test(api): ajoute un test d'isolation entre households
refactor(mobile): simplifie le hook useItems
```

Scope entre parenthèses optionnel mais recommandé quand le changement touche un package identifiable (`api`, `mobile`, `api-client`, `shared`).

## Avant toute pull request

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @notre-nid/api run test:e2e   # nécessite docker compose up -d (PostgreSQL + Mailpit)
```

Toutes ces commandes doivent réussir — la CI (`.github/workflows/ci.yml`) les exécute automatiquement sur chaque pull request et sur `main`, avec des services PostgreSQL et Mailpit réels.

## Règles permanentes du dépôt

Rappel des règles qui s'appliquent à toute contribution (détail complet dans `CLAUDE.md`) :

- Isolation stricte entre households — toute modification touchant les permissions, l'authentification ou l'isolation des données doit être accompagnée de tests.
- Toute évolution du schéma Prisma passe par une **nouvelle** migration — ne jamais modifier une migration déjà appliquée.
- Aucune modification cassante du contrat API sans migration, versionnement (`/api/v1` → `/api/v2` si nécessaire) et documentation associés (`docs/API.md`, `docs/openapi.json`).
- Aucun secret réel dans le dépôt, sous quelque forme que ce soit (y compris dans l'historique de commits).
- Documentation maintenue en même temps que le code (README, `docs/PHASE_STATUS.md` si le changement affecte l'état d'une phase).
- Aucune fonctionnalité partielle ne doit être présentée comme terminée.

## Structure du monorepo

Voir la section « Architecture du dépôt » du [README](README.md) et [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) pour le détail des frontières entre modules.
