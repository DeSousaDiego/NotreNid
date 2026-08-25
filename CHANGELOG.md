# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Ce projet n'a pas encore de version publiée (aucun déploiement en production, aucune app soumise aux stores) — voir `docs/GO_LIVE_CHECKLIST.md`. Le détail complet de chaque phase (fichiers modifiés, commandes exécutées, décisions, problèmes rencontrés) reste dans `docs/PHASE_STATUS.md`, source de vérité de l'historique de développement.

## [Non publié]

### Phase 5 — Livraison

#### Added

- Driver de stockage S3-compatible (`apps/api/src/uploads/storage/s3-storage.driver.ts`) — comble un écart avec `docs/NOTRE_NID_PRD.md` section 10 (`STORAGE_DRIVER=s3` était déclaré mais non implémenté) ; fonctionne avec AWS S3, Supabase Storage et MinIO.
- Dockerfile multi-stage de production (`infrastructure/docker/api/Dockerfile`, cibles `runtime` et `migrate`), utilisateur non root, healthcheck réel.
- Script de sauvegarde PostgreSQL (`infrastructure/scripts/backup-postgres.sh`) et script `db:migrate:deploy` (`prisma migrate deploy`, distinct de `migrate dev`).
- Configuration EAS (`apps/mobile/eas.json`, profils `development`/`preview`/`production`).
- Documentation complète de livraison : `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DEPLOYMENT.md`, `docs/BACKUP_AND_RESTORE.md`, `docs/OPERATIONS.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`, `docs/MOBILE_RELEASE.md`, `docs/GO_LIVE_CHECKLIST.md`, `CONTRIBUTING.md`, `SECURITY.md`.

### Phase 4 — Qualité

#### Added

- Documentation OpenAPI complète sur toutes les routes, contrat figé (`docs/openapi.json`) et vérification de cohérence compilée du client API (`packages/api-client/src/contract.ts`).
- CI GitHub Actions (`.github/workflows/ci.yml`).
- Rate limiting sur l'authentification, logs structurés (JSON en production), limite de taille des corps de requête.
- 6 tests de rendu d'écran mobile manquants, test e2e de rate limiting.

#### Fixed

- `/health/ready` ne vérifiait jamais réellement la disponibilité de la base de données depuis sa création en Phase 1.

### Phase 3 — Mobile (3A + 3B)

#### Added

- Application mobile Expo complète : thème « Notre Nid », design system, authentification, sélection de household, écrans Accueil/Collection/Détail/Recherche/Profil, ajout/modification d'item en 3 étapes, upload de couverture, archivage/restauration, gestion des membres/invitations/catégories personnalisées, exports JSON/CSV.

#### Fixed

- Fuite de sécurité héritée de la Phase 2 : les endpoints d'invitation renvoyaient `tokenHash` en clair.
- Suppression d'une catégorie encore référencée par un item renvoyait une erreur 500 brute plutôt qu'un message convivial.

### Phase 2 — Backend métier

#### Added

- Schéma Prisma complet et première migration, script de seed.
- Authentification (Argon2, JWT access + refresh révocable), households, membres, invitations, catégories système et personnalisées, items avec propriétaires multiples, recherche, uploads (stockage local), statistiques, exports JSON/CSV.
- Isolation stricte entre households, testée explicitement.

### Phase 1 — Fondation

#### Added

- Monorepo pnpm, TypeScript strict, ESLint/Prettier/Husky, Docker Compose (PostgreSQL/Mailpit/MinIO), squelette API NestJS, squelette mobile Expo Router, packages partagés.
