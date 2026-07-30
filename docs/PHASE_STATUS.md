# Statut des phases — Notre Nid

## Phase courante

**Phase 2 — Backend métier** : ✅ terminée et validée. Prochaine phase : **Phase 3 — Mobile** (non démarrée).

Historique : Phase 1 — Fondation ✅ (voir section dédiée plus bas).

---

## Phase 2 — Backend métier

### Éléments terminés

- **Modèle de données Prisma complet** (`apps/api/prisma/schema.prisma`) : `User`, `Household`, `HouseholdMember` (rôles `OWNER`/`ADMIN`/`MEMBER`), `HouseholdInvitation`, `Category` (système + personnalisée, `metadataSchema` JSON pour les catégories personnalisées), `Item`, `ItemOwner` (relation m2m explicite, jamais un simple `ownerId`), `BookMetadata`/`CdMetadata`/`DvdMetadata` (1-1 avec `Item`), `RefreshSession`, `AuditLog`.
- **Première migration** `20260730073710_init` appliquée sur la base Dockerisée, puis validée une seconde fois via une réinitialisation complète (`prisma migrate reset --force`, avec consentement explicite de l'utilisateur — voir « Confirmation destructrice » ci-dessous) suivie d'un nouveau `prisma db seed`.
- **`PrismaService`** utilisant le driver adapter `@prisma/adapter-pg` (`new PrismaPg({ connectionString })`), requis par Prisma 7 (voir la découverte de Phase 1).
- **Authentification** (`apps/api/src/auth`) : Argon2 pour le hash des mots de passe, JWT access (courte durée, secret dédié) + refresh token opaque (aléatoire, hashé en HMAC-SHA256 avant stockage, rotatif et révocable via `RefreshSession`). Endpoints `register`, `login`, `refresh`, `logout`, `logout-all`, `me`.
- **Households** (`apps/api/src/households`) : CRUD, gestion des membres (liste, changement de rôle, retrait), `leave`. Règle « dernier OWNER » appliquée strictement (ne peut ni être rétrogradé, ni retiré, ni quitter le household).
- **Invitations** (`apps/api/src/invitations`) : création (OWNER/ADMIN), liste, acceptation par jeton (vérifie la correspondance d'email), révocation. Email réel envoyé via Mailpit (SMTP local, `nodemailer`), en plus du jeton loggé et renvoyé dans la réponse de création (développement uniquement).
- **Catégories** (`apps/api/src/categories`) : catégories système (`BOOK`/`CD`/`DVD`, `householdId` nul, non modifiables/supprimables) + catégories personnalisées par household (OWNER/ADMIN), avec validation légère du schéma de métadonnées personnalisé (`metadataSchema`).
- **Items** (`apps/api/src/items`) : CRUD complet, propriétaires multiples (validés comme membres du household), métadonnées typées par catégorie système (livre/CD/DVD) ou JSON validé pour les catégories personnalisées, recherche insensible à la casse (titre, description, notes, auteur, ISBN, artiste, album, réalisateur), filtres (catégorie, propriétaire, condition, créateur, archivage), tri, pagination avec métadonnées (`page`, `pageSize`, `totalItems`, `totalPages`), archivage (suppression logique) et restauration.
- **Isolation stricte entre households** : chaque accès à un item vérifie que celui-ci appartient bien au household ciblé par l'URL — un item d'un autre household renvoie systématiquement `404 NOT_FOUND`, jamais de fuite d'information. Testé explicitement (voir tests e2e).
- **Uploads** (`apps/api/src/uploads`) : stockage local (`apps/api/storage/uploads/`, ignoré par Git), validation du type réel par signature binaire (magic bytes JPEG/PNG/WebP — jamais l'extension ni le `Content-Type` déclaré), taille maximale (10 Mo), noms de fichiers non prédictibles (`crypto.randomUUID()`), suppression protégée contre la traversée de répertoire. Fichiers servis statiquement sous `/uploads`.
- **Statistiques** (`apps/api/src/stats`) et **exports** (`apps/api/src/exports`, JSON et CSV — sérialiseur CSV écrit à la main, sans dépendance externe).
- **Format d'erreur standard** (`{ statusCode, code, message, details, requestId }`) via un filtre d'exception global, middleware `requestId` (généré ou propagé depuis l'en-tête `x-request-id`).
- **Sécurité applicative** : guard JWT maison (pas de `passport`, une dépendance de moins), guard d'appartenance au household (vérifie systématiquement `:householdId` contre la base, jamais de confiance aveugle), guard de rôle (`@HouseholdRoles(...)`).
- **Script de seed** (`apps/api/prisma/seed.ts`) : 2 utilisateurs de démonstration (`alex@notre-nid.demo`, `sam@notre-nid.demo`, mot de passe `notre-nid-demo`), 1 household commun, 3 catégories système, 4 items (propriétaire unique ×2, partagé ×1, archivé ×1). Idempotent (relançable sans erreur).
- **Swagger/OpenAPI** : tags, `@ApiBearerAuth`, DTO annotés (`@ApiProperty`) sur l'ensemble des modules — 26 routes et 15 schémas générés sans erreur (vérifié via `/api/v1/docs-json`).
- **Tests** : 24 tests unitaires (règle du dernier OWNER, validation des propriétaires, isolation via `getOwnedItem`, cycle Argon2/JWT complet, guard d'appartenance et de rôle) + 13 tests e2e contre la base PostgreSQL réelle (cycle d'authentification complet avec rotation de refresh token, cycle de vie complet d'un household avec invitations et rôles, CRUD/archivage d'items, stats/exports, **et le cas critique obligatoire d'isolation entre households**).

### Fichiers principaux créés ou modifiés

- `apps/api/prisma/schema.prisma` (modèle complet), `apps/api/prisma/migrations/20260730073710_init/`, `apps/api/prisma/seed.ts`, `apps/api/prisma.config.ts` (seed + chargement `.env` racine).
- `apps/api/src/prisma/` (`PrismaService`/`PrismaModule`).
- `apps/api/src/common/` (filtre d'exception, middleware request-id, guards, décorateurs, mappers, utilitaires, `CommonModule`).
- `apps/api/src/auth/`, `apps/api/src/households/`, `apps/api/src/invitations/`, `apps/api/src/categories/`, `apps/api/src/items/`, `apps/api/src/uploads/`, `apps/api/src/stats/`, `apps/api/src/exports/`, `apps/api/src/mail/` (modules complets : contrôleurs, services, DTO).
- `apps/api/src/app.module.ts`, `apps/api/src/main.ts` (filtre global, fichiers statiques `/uploads`).
- Tests : `*.service.spec.ts`, `*.guard.spec.ts` (unitaires), `apps/api/test/auth.e2e-spec.ts`, `apps/api/test/households-items.e2e-spec.ts` (e2e).
- `packages/eslint-config/base.js` : règle `@typescript-eslint/consistent-type-imports` retirée (voir « Problèmes rencontrés »).

### Migrations ajoutées

- `20260730073710_init` : création de l'ensemble du schéma (tables, enums `HouseholdRole`/`ItemCondition`, contraintes uniques, index).

### Commandes réellement exécutées et leur résultat

| Commande | Résultat |
| --- | --- |
| `npx prisma migrate dev --name init` | ✅ succès — migration créée et appliquée sur la base Dockerisée |
| `npx prisma migrate reset --force` (1ère tentative) | ❌ bloqué par Prisma lui-même : détection d'un agent IA, exige un consentement explicite de l'utilisateur (voir « Confirmation destructrice ») |
| `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="Oui, confirmé" npx prisma migrate reset --force` | ✅ succès — base réinitialisée, migration réappliquée depuis zéro |
| `pnpm run db:seed` (après reset) | ✅ succès — comptes de démonstration créés |
| Vérification directe en base (requête Prisma ad hoc) | ✅ `{ users: 2, households: 1, categories: 3, items: 4, archived: 1 }` — conforme au seed |
| `pnpm -r --if-present run lint` | ✅ succès après correction (voir « Problèmes rencontrés ») |
| `pnpm run format:check` | ✅ succès après `pnpm run format` |
| `pnpm -r --if-present run typecheck` | ✅ succès sur les 4 packages TypeScript |
| `pnpm --filter @notre-nid/api run test` | ✅ 24/24 tests unitaires |
| `pnpm --filter @notre-nid/api run test:e2e` | ✅ 13/13 tests e2e (dont le test critique d'isolation) contre PostgreSQL réel |
| `pnpm -r --if-present run build` | ✅ succès (`apps/api`, `packages/shared`, `packages/api-client`) |
| Démarrage réel (`node dist/main.js`) + parcours complet via `curl` (register/login/me/households/categories/items/stats/exports, y compris avec le compte de démonstration seedé) | ✅ tous les appels répondent correctement, isolation vérifiée manuellement (404/403) |
| `curl /api/v1/docs-json` | ✅ 200 — 26 routes, 15 schémas, aucune erreur de génération malgré les DTO imbriqués (`PartialType`, `@ValidateNested`) |

### Confirmation destructrice (base de données)

`prisma migrate reset --force` a été explicitement demandé par l'utilisateur pour valider les migrations « sur une base propre ». Prisma a lui-même détecté l'exécution par un agent IA et a bloqué la commande, exigeant un consentement explicite. **L'utilisateur a été interrogé directement et a confirmé** (« Oui, confirmé ») avant toute exécution — la commande n'a été relancée qu'après cette confirmation, avec la variable d'environnement `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` requise par Prisma pour tracer ce consentement. Aucune donnée réelle n'était à risque (uniquement des données de test créées pendant la session, sur la base Docker locale).

### Problèmes rencontrés et corrigés

- **`.env` non trouvé par Prisma** : `dotenv/config` (import automatique) cherche `.env` dans `process.cwd()`, qui vaut `apps/api` lors des commandes `pnpm --filter`, alors que le `.env` unique du monorepo est à la racine. Corrigé dans `prisma.config.ts` et `app.module.ts` (`ConfigModule.forRoot({ envFilePath: ... })`) en résolvant explicitement le chemin vers la racine.
- **Upsert impossible sur une clé composée nullable** : Prisma refuse `null` dans un `where` de clé unique composée (`@@unique([householdId, slug])`) pour les catégories système (`householdId: null`). Le seed utilise `findFirst` + création conditionnelle plutôt que `upsert` pour ces trois lignes.
- **`EADDRINUSE` / builds fantômes pendant le développement** : plusieurs process Node orphelins (lancés lors de tests manuels) ont occupé le port 3000 ; un cache `.tsbuildinfo` obsolète a empêché `tsc`/`nest build` de régénérer `dist/` après une suppression manuelle. Résolu en tuant les process concernés et en supprimant les fichiers `.tsbuildinfo` avant reconstruction — n'affecte pas le comportement normal (`nest build` supprime et régénère `dist/` correctement de lui-même).
- **Bug sérieux d'auto-fix ESLint cassant l'injection de dépendances NestJS** : la règle `@typescript-eslint/consistent-type-imports` (avec `--fix`) a converti en `import type` de nombreux imports de classes utilisées uniquement comme paramètres de constructeur ou de méthode décorée (`@Body()`, `@Query()`). Or NestJS a besoin de la référence runtime de ces classes (via les métadonnées de décorateur `design:paramtypes`, émises par `emitDecoratorMetadata`) pour résoudre l'injection de dépendances **et** pour que `ValidationPipe` sache quel DTO valider. Un `import type` à cet endroit fait planter le démarrage de l'application (guards) ou risquerait de désactiver silencieusement la validation (DTO). Détecté grâce aux tests e2e réels (jamais visible au typecheck ni au lint). **Corrigé** : la règle a été retirée de `packages/eslint-config/base.js` (documenté dans le fichier), et chaque import concerné a été manuellement repassé en import de valeur. Tous les tests unitaires et e2e ont été revérifiés après correction.
- **`prisma migrate reset` n'exécute pas le seed automatiquement avec `--force`** dans cette version : le seed a dû être relancé manuellement (`pnpm run db:seed`) après le reset.

### Décisions prises

- Refresh token **opaque** (aléatoire, 48 octets) plutôt qu'un second JWT : plus simple, la révocation est de toute façon pilotée par la base (`RefreshSession`), pas besoin de vérifier une signature en plus d'un hash.
- Guard JWT et guard de household écrits à la main plutôt qu'avec `passport`/`passport-jwt` : une dépendance de moins pour un besoin simple (vérification Bearer + `JwtService.verifyAsync`).
- Révocation d'invitation implémentée par **suppression** de la ligne (pas de colonne `revokedAt` ajoutée au schéma du PRD) : une invitation révoquée n'a plus de raison d'exister.
- CSV exporté via un sérialiseur écrit à la main plutôt que `json2csv` (dernière version encore en alpha, projet apparemment à l'arrêt depuis 2023) — évite une dépendance semi-abandonnée pour un besoin trivial.
- Validation des métadonnées de catégories personnalisées : vérification simple typée (chaîne/nombre/booléen, champ requis ou non) plutôt qu'un moteur JSON-Schema complet, conformément à la mise en garde du PRD contre une architecture « excessivement dynamique ».
- Rate limiting sur l'authentification et client API généré depuis le contrat OpenAPI : **explicitement reportés en Phase 4**, comme déjà prévu dans `docs/IMPLEMENTATION_PLAN.md` — non traités ici pour respecter le périmètre de la Phase 2.

### Actions manuelles restantes

Aucune pour le développement local. Les comptes de démonstration (`alex@notre-nid.demo` / `sam@notre-nid.demo`, mot de passe `notre-nid-demo`) sont utilisables immédiatement après `pnpm db:seed`.

### Prochaine étape recommandée

Démarrer la **Phase 3 — Mobile** : système de thème, navigation à cinq destinations, état d'authentification (SecureStore), sélection de household, écrans Accueil/Collection/Détail/Ajout/Profil (voir `docs/IMPLEMENTATION_PLAN.md`).

---

## Phase 1 — Fondation ✅ (historique)

### Éléments terminés

- Correction d'une incohérence documentaire : `CLAUDE.md` importait `docs/NOTRE_NID_PRD.md`, un chemin inexistant. Le PRD (`docs/Notre_Nid_PRD_Prompt_Claude_Code.md`) a été renommé vers ce chemin (`git mv`) pour devenir la source de vérité réelle, sans duplication.
- Monorepo pnpm workspaces (`apps/*`, `packages/*`), sans Turborepo (jugé non nécessaire à ce stade).
- TypeScript strict partagé via `packages/config` (base commune) + configurations spécifiques par app.
- ESLint (flat config) et Prettier partagés via `packages/eslint-config`, avec un preset `node` (API, packages) et un preset `react-native` (mobile, basé sur `eslint-config-expo/flat`).
- `docker-compose.yml` : PostgreSQL 16, Mailpit ; MinIO optionnel derrière le profil `storage`.
- `.env.example` complet (toutes les variables de la section 13 du PRD), sans secret réel.
- API NestJS (`apps/api`) : bootstrap avec `helmet`, préfixe `/api/v1`, `ValidationPipe` global, CORS configurable, Swagger en développement (`/api/v1/docs`), module `health` (`GET /health`, `GET /health/ready`).
- Prisma initialisé (`apps/api/prisma/schema.prisma` + `prisma.config.ts`) : datasource et generator uniquement en Phase 1 (modèle complet ajouté en Phase 2).
- Application mobile Expo (`apps/mobile`) : squelette Expo Router + TypeScript strict, un unique écran de bienvenue. Le contenu de démonstration du template `create-expo-app` a été retiré pour ne pas laisser de fausses fonctionnalités.
- Packages partagés : `packages/shared` et `packages/api-client` — tous deux buildables (`api-client` dépend de `shared` via `workspace:*`).
- `docker compose up -d` validé (PostgreSQL et Mailpit `healthy`), après installation de WSL2 par le propriétaire du dépôt (Windows 11 Home, backend WSL2 obligatoire pour Docker Desktop).

### Découverte importante (héritée en Phase 2)

- **Prisma 7 (`prisma-client-js`) exige un adaptateur de driver explicite** (`@prisma/adapter-pg` + `pg`) — confirmé et exploité dans `PrismaService` en Phase 2.
- Générateur Prisma choisi : `prisma-client-js` (classique, CommonJS) plutôt que le nouveau générateur `prisma-client` (TypeScript ESM avec `import.meta`, incompatible avec NestJS CommonJS/décorateurs).
- TypeScript fixé à `6.0.3` (pas `7.0.2`) car `@typescript-eslint` ne supporte que `<6.1.0`.
- ESLint fixé à `9.39.5` (pas 10) : `eslint-plugin-import@2.32.0` plante sous ESLint 10 lors du calcul d'un correctif `import/order`.
