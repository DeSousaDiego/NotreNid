# Notre Nid

Application mobile de gestion de collection partagée pour un couple (livres, CD, DVD, catégories personnalisables). Cahier des charges complet : [docs/NOTRE_NID_PRD.md](docs/NOTRE_NID_PRD.md).

## Statut du projet

La **Phase 3 — Mobile** est terminée et validée dans son ensemble (3A et 3B, lint, format, typecheck, tests, build, verts sur tout le monorepo — voir [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)). La **Phase 4 — Qualité** n'a pas démarré. Voir [docs/PHASE_STATUS.md](docs/PHASE_STATUS.md) pour le détail complet de l'état actuel.

Ce qui existe aujourd'hui :

- un monorepo pnpm fonctionnel (`apps/*`, `packages/*`) ;
- une API NestJS complète : authentification (Argon2 + JWT access/refresh révocable), households (membres, rôles, invitations par email via Mailpit), catégories système et personnalisées, items (propriétaires multiples, recherche, filtres, pagination, archivage/restauration), uploads d'images (validation réelle du type de fichier), statistiques, exports JSON/CSV ;
- isolation stricte entre households, vérifiée à chaque requête et testée explicitement (un membre d'un household ne peut jamais accéder aux données d'un autre) ;
- documentation Swagger complète (`/api/v1/docs`) ;
- un schéma Prisma complet avec sa première migration, et un script de seed idempotent (2 comptes de démonstration, 1 household, 3 catégories, 4 items) ;
- un client API typé (`packages/api-client`) et des types de domaine partagés (`packages/shared`), miroir exact des réponses de l'API ;
- une application mobile Expo (Expo Router, TypeScript strict) avec : système de thème « Notre Nid », design system de 18 composants, authentification (SecureStore, restauration/rafraîchissement de session), sélection de household, écrans Accueil/Collection/Détail/Recherche, et un Profil restructuré en pile de navigation (membres, invitations, catégories, archives, rejoindre un foyer) ; ajout/modification d'item en 3 étapes (catégorie → métadonnées → propriétaires/couverture/récapitulatif), upload/remplacement/suppression de couverture, archivage/restauration, gestion des membres et invitations, gestion des catégories personnalisées, exports JSON/CSV avec partage natif ;
- un environnement Docker local (PostgreSQL, Mailpit, MinIO optionnel).

## Stack

- **Mobile** : Expo (SDK 57), Expo Router, React Native, TypeScript strict, TanStack Query, React Hook Form + Zod, Expo SecureStore.
- **API** : Node.js LTS, NestJS 11, REST, class-validator, Argon2, JWT (access + refresh révocable via driver PostgreSQL propre).
- **Base de données** : PostgreSQL 16, Prisma ORM (driver adapter `@prisma/adapter-pg`, requis par Prisma 7).
- **Stockage** : local en développement (validation réelle du type de fichier par signature binaire), S3-compatible/Supabase Storage prévu en production (Phase 5).
- **Emails** : Mailpit en développement (capture SMTP locale), réel via `nodemailer`.
- **Tests** : Jest (API : unitaire + e2e via Supertest contre PostgreSQL réel ; `api-client` : unitaire ; mobile : `jest-expo` + `@testing-library/react-native`, composants/hooks/providers).
- **CI** : à mettre en place en Phase 4.

## Pré-requis

- Node.js 22 LTS
- pnpm ≥ 11 (`corepack enable` ou `npm install -g pnpm`)
- Docker Desktop (PostgreSQL, Mailpit, MinIO en local) — sur Windows Home, nécessite WSL2 (`wsl --install`)
- Expo Go (mobile) ou un simulateur iOS / émulateur Android

## Installation locale

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:generate
pnpm --filter @notre-nid/api exec prisma migrate dev   # applique les migrations
pnpm --filter @notre-nid/api run db:seed                # crée les comptes de démonstration
pnpm dev:api      # démarre l'API sur http://localhost:3000
pnpm dev:mobile   # démarre Expo (Metro / Expo Dev Tools)
```

## Variables d'environnement

Voir [.env.example](.env.example) pour la liste complète et commentée. Points clés :

- `DATABASE_URL` : connexion PostgreSQL (doit correspondre aux identifiants de `docker-compose.yml` en local).
- `JWT_ACCESS_SECRET` / `JWT_ACCESS_TTL` / `JWT_REFRESH_SECRET` / `JWT_REFRESH_TTL` : secrets et durées de vie des tokens — secrets de développement uniquement, à régénérer avant toute mise en production.
- `MOBILE_PUBLIC_API_URL` : seule variable destinée à être embarquée dans le bundle mobile ; ne doit jamais contenir de secret.
- `STORAGE_DRIVER=local` : stockage local des images en développement (`apps/api/storage/uploads/`, ignoré par Git) ; un driver S3-compatible sera ajouté en Phase 5.
- `SMTP_HOST` / `SMTP_PORT` : par défaut, Mailpit local (`localhost:1025`) — les emails d'invitation y sont capturés (interface web sur `http://localhost:8025`).

## Base de données

- Schéma complet : [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma) (`User`, `Household`, `HouseholdMember`, `HouseholdInvitation`, `Category`, `Item`, `ItemOwner`, `BookMetadata`/`CdMetadata`/`DvdMetadata`, `RefreshSession`, `AuditLog`).
- Générer le client Prisma : `pnpm db:generate`.
- Appliquer les migrations : `pnpm --filter @notre-nid/api exec prisma migrate dev`.
- Seed (idempotent) : `pnpm --filter @notre-nid/api run db:seed`.
- Réinitialiser complètement la base locale : `pnpm --filter @notre-nid/api run db:reset` (⚠️ détruit toutes les données locales ; ne jamais utiliser contre une base de production).
- Prisma Studio : `pnpm --filter @notre-nid/api exec prisma studio`.

## Lancement

```bash
docker compose up -d              # PostgreSQL + Mailpit (+ MinIO via --profile storage)
pnpm dev:api                      # API NestJS (http://localhost:3000/api/v1/health)
pnpm dev:mobile                   # Application mobile (Expo)
pnpm test                         # Tests unitaires (tous les packages qui en définissent)
pnpm --filter @notre-nid/api run test:e2e   # Tests d'intégration (nécessitent PostgreSQL démarré)
```

## Comptes de démonstration

Créés par `pnpm --filter @notre-nid/api run db:seed` — **développement uniquement, jamais en production** :

| Email | Mot de passe | Rôle |
| --- | --- | --- |
| `alex@notre-nid.demo` | `notre-nid-demo` | OWNER du household « Notre nid » |
| `sam@notre-nid.demo` | `notre-nid-demo` | MEMBER du household « Notre nid » |

## Architecture du dépôt

```text
apps/
  api/            NestJS — API REST (/api/v1), Prisma, Swagger en développement
    src/
      auth/            Inscription, connexion, refresh, déconnexion
      households/      Households, membres, rôles
      invitations/      Invitations par email (Mailpit)
      categories/       Catégories système et personnalisées
      items/            Items, propriétaires, recherche, archivage
      uploads/          Stockage local des images
      stats/            Statistiques par household
      exports/          Exports JSON/CSV
      prisma/           PrismaService (driver adapter pg)
      common/           Guards, filtre d'erreurs, décorateurs, utilitaires partagés
  mobile/         Expo Router — application mobile TypeScript strict
    src/
      theme/           Tokens de couleur/typographie/espacement, ThemeProvider
      components/      Design system (18 composants réutilisables)
      providers/       QueryProvider, AuthProvider, HouseholdProvider
      hooks/           Hooks TanStack Query par ressource (items, households, stats, mutations, ...)
      lib/             Config, stockage sécurisé des tokens, clés de requête, messages d'erreur, export de fichiers
      screens/         Écrans partagés (sélection de household, formulaire d'ajout/modification d'item)
      app/             Routes Expo Router : (auth) connexion/inscription, (app) onglets (dont profile/ en pile)
packages/
  shared/         Types et constantes partagés entre l'API et le mobile
  api-client/      Client HTTP typé consommé par le mobile (auth, households, catégories, items, invitations, uploads, exports, stats)
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
| `pnpm test` | Tests unitaires (packages qui en définissent) |
| `pnpm db:generate` | Génère le client Prisma |

Scripts spécifiques à l'API (`pnpm --filter @notre-nid/api run <script>`) : `db:migrate`, `db:seed`, `db:reset`, `test:e2e`.

## Tests

```bash
pnpm --filter @notre-nid/api run test         # 33 tests unitaires (Jest)
pnpm --filter @notre-nid/api run test:e2e     # 13 tests d'intégration (Supertest, PostgreSQL réel requis)
pnpm --filter @notre-nid/api-client run test  # 8 tests unitaires (client HTTP : auth, rafraîchissement, erreurs, FormData, texte brut)
pnpm --filter @notre-nid/mobile run test      # 67 tests (composants, hooks de mutation, schéma du formulaire d'item, écrans)
```

Couverture API actuelle : règle du dernier propriétaire (households), validation des propriétaires d'items, isolation entre households (guard + service), cycle Argon2/JWT complet (register/login/refresh/logout), cycle de vie complet d'un household (création, invitation, acceptation, rôles), CRUD et archivage d'items, catégories (permissions, catégorie en cours d'utilisation), non-fuite du jeton d'invitation, statistiques et exports — **y compris le cas critique obligatoire** : un membre du household A ne peut jamais lire, modifier ou supprimer un item du household B.

Couverture mobile actuelle : composants de consultation et d'administration (`Button`, `ConditionBadge`, `ItemCard`, `EmptyState`, `ErrorState`, `ConfirmDialog`), hook de debounce, formatage des messages d'erreur, `AuthProvider` (restauration de session, connexion, déconnexion, déconnexion globale, expiration de session), chaque hook de mutation (items, catégories, membres, invitations, uploads, exports), le schéma du formulaire d'ajout/modification d'item (construction du payload par catégorie, conversion inverse pour l'édition), l'écriture/partage des exports, et un test d'intégration du formulaire d'ajout d'item de bout en bout.

## Déploiement

Non applicable à ce stade (Phase 5). Aucun déploiement, migration de production ou opération destructive n'est effectué sans autorisation explicite du propriétaire du dépôt.

## Génération mobile

Non applicable à ce stade (Phase 5, voir `docs/MOBILE_RELEASE.md` à venir).

## Sécurité

- `helmet`, un préfixe d'API versionné (`/api/v1`) et une validation globale des DTO (`whitelist`, `forbidNonWhitelisted`, `transform`) sont en place.
- Mots de passe hachés avec Argon2 ; jamais retournés par l'API.
- JWT access (courte durée) + refresh token opaque, rotatif et révocable (stocké hashé en base, jamais en clair).
- Isolation stricte des households : chaque route vérifiée contre la base (jamais de confiance dans un `householdId` reçu du client), testée explicitement (e2e).
- Uploads : validation du type réel par signature binaire (pas l'extension ni le `Content-Type` déclaré), taille maximale, noms de fichiers non prédictibles.
- Rate limiting sur l'authentification : **prévu Phase 4** (voir `docs/IMPLEMENTATION_PLAN.md`).
- Aucun secret réel n'est commité ; `.env.example` ne contient que des valeurs de développement explicitement fictives.
- `SECURITY.md` détaillé sera créé en Phase 5 ; les règles permanentes en vigueur sont dans [CLAUDE.md](CLAUDE.md).

## Sauvegardes

Non applicable à ce stade (Phase 5, voir `docs/BACKUP_AND_RESTORE.md` à venir).

## Limitations connues

- **Vérification visuelle du mobile sur simulateur/émulateur non réalisée**, en Phase 3A comme en Phase 3B (pas de simulateur iOS sous Windows, pas d'émulateur Android démarré). De plus, `npx expo start`/`expo export` rencontrent un bug de résolution de module Metro spécifique à cet environnement (Windows + pnpm + monorepo) qui empêche de servir le bundle applicatif — voir `docs/PHASE_STATUS.md` pour la reproduction complète. Tous les parcours de mutation ont néanmoins été vérifiés par des appels HTTP réels contre l'API et PostgreSQL réels, en plus des tests automatisés. À vérifier manuellement (appareil réel ou machine macOS/Linux) avant la Phase 4 ou la livraison.
- **Pas de test de rendu d'écran complet** pour les écrans Profil/Membres/Invitations/Catégories/Archives/Rejoindre (seul le formulaire d'ajout d'item en a un) : la logique de mutation sous-jacente est testée unitairement et vérifiée en direct contre l'API réelle.
- Quelques paquets Expo (`expo`, `expo-router`, `expo-constants`, `expo-linking`, `expo-system-ui`, `react-native`) sont en léger retard sur les derniers correctifs SDK 57 : une tentative de mise à jour a provoqué une régression du bundler Metro et a été annulée (voir `docs/PHASE_STATUS.md`).
- Recherche full-text PostgreSQL, rate limiting, client API généré depuis OpenAPI, CI : prévus Phases 4-5 (déjà documentés dans `docs/IMPLEMENTATION_PLAN.md`).
- Stockage d'images local uniquement pour l'instant (pas de driver S3, prévu Phase 5).
- `prisma migrate reset` n'exécute pas automatiquement le seed dans cette version : relancer `pnpm --filter @notre-nid/api run db:seed` manuellement après un reset.

## Roadmap

Voir la section « Roadmap future » de [docs/NOTRE_NID_PRD.md](docs/NOTRE_NID_PRD.md#27-roadmap-future) (scan ISBN, wishlist, prêts, tags, mode offline-first, etc.) et [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) pour les phases 3 à 5.
