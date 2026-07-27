# Notre Nid

Le cahier des charges principal du projet est disponible ici :

@docs/NOTRE_NID_PRD.md

## Règles permanentes

- Le PRD est la source de vérité.
- Développer le projet phase par phase.
- Ne jamais commencer une nouvelle phase sans avoir validé la précédente.
- Utiliser TypeScript strict.
- Maintenir l’isolation complète entre les households.
- Ne jamais commiter de secret réel.
- Exécuter le lint, le typecheck, les tests et les builds après chaque phase.
- Ne jamais présenter une fonctionnalité partielle comme terminée.
- Maintenir la documentation en même temps que le code.
- Ne pas effectuer d’opération destructive ou de déploiement sans autorisation.
- Toute évolution du schéma Prisma passe par une nouvelle migration (ne jamais modifier une migration déjà appliquée).
- Toute modification des permissions, de l’authentification ou de l’isolation des households doit être accompagnée de tests.
- Ne jamais casser le contrat de l’API sans migration, versionnement et documentation associés.

## Architecture du monorepo

pnpm workspaces (pas de Turborepo pour l’instant).

```text
apps/api            NestJS — API REST (/api/v1), Prisma, Swagger en développement
apps/mobile          Expo Router — application mobile TypeScript strict
packages/shared      Types et constantes partagés (API ↔ mobile)
packages/api-client  Client HTTP typé consommé par le mobile
packages/config      tsconfig de base partagé
packages/eslint-config  Configuration ESLint (flat config) partagée
```

Frontières : le mobile ne doit jamais appeler l’API directement depuis un composant — passer par `packages/api-client`. La logique métier vit dans l’API (services NestJS), jamais dans les contrôleurs ni dans les composants visuels du mobile.

## Commandes exactes

```bash
pnpm install                     # installation (racine)
cp .env.example .env             # variables d'environnement locales
docker compose up -d             # PostgreSQL + Mailpit (+ MinIO via --profile storage)
pnpm db:generate                 # génère le client Prisma
pnpm --filter @notre-nid/api exec prisma migrate dev   # migrations (à partir de la Phase 2)

pnpm dev:api                     # API en mode watch
pnpm dev:mobile                  # Expo (Metro)

pnpm lint / pnpm lint:fix        # ESLint sur tout le monorepo
pnpm format / pnpm format:check  # Prettier
pnpm typecheck                   # tsc --noEmit sur tout le monorepo
pnpm test                        # tests (Jest) des packages qui en définissent
pnpm build                       # build de tous les packages/apps concernés
```

Voir [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) pour l’ordre des phases et [docs/PHASE_STATUS.md](docs/PHASE_STATUS.md) pour l’état courant.