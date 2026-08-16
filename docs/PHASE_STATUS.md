# Statut des phases — Notre Nid

## Phase courante

**Phase 4 — Qualité** : ✅ terminée et validée.

Les **Phases 1 à 4** sont donc toutes terminées — voir `docs/IMPLEMENTATION_PLAN.md`. La **Phase 5 — Livraison** n'a pas démarré.

Historique : Phase 1 — Fondation ✅, Phase 2 — Backend métier ✅, Phase 3A — Fondations mobiles et parcours de consultation ✅, Phase 3B — Mutations, administration et finalisation mobile ✅ (voir sections dédiées plus bas).

---

## Phase 4 — Qualité

### Éléments terminés

- **Correctif découvert en auditant les endpoints de santé** : `/health/ready` (`apps/api/src/health/health.controller.ts`) était strictement identique à `/health` depuis la Phase 1, malgré un commentaire annonçant « la vérification de disponibilité de la base de données sera ajoutée en Phase 2 » — jamais tenu, y compris après que `PrismaModule` a été branché en Phase 2. Corrigé en premier, avant tout autre travail de la Phase 4 : `ready()` exécute désormais `SELECT 1` via Prisma et répond `503 DATABASE_UNAVAILABLE` (format d'erreur standard, via `AppException`) si la base est injoignable. Test unitaire réécrit avec `PrismaService` mocké (cas succès/échec) ; le test e2e existant (`GET /health/ready -> 200`) reste vert contre PostgreSQL réel.
- **Rate limiting** (`@nestjs/throttler` 6.5.0) : limite globale par défaut de 100 req/min (toutes routes, `ThrottlerGuard` en garde globale via `APP_GUARD`), et une limite renforcée de 10 req/min sur `/auth/register`, `/auth/login` et `/auth/refresh` (`AuthController`, décorateur `@Throttle` partagé) — cibles privilégiées du bourrage d'identifiants, non protégées par JWT. Le code d'erreur `429 TOO_MANY_REQUESTS` était déjà prévu dans `HttpExceptionFilter` depuis la Phase 2 mais mort (rien ne le déclenchait) ; il est maintenant réellement exercé. Nouveau test e2e dédié (`test/rate-limiting.e2e-spec.ts`, fichier isolé pour ne pas partager son `ThrottlerStorage` en mémoire avec les autres suites e2e) : 11 tentatives de connexion avec un mauvais mot de passe, la 11ᵉ doit renvoyer `429` avec le format d'erreur standard.
- **Limite de taille des corps de requête** : `app.useBodyParser('json'|'urlencoded', { limit: '1mb' })` dans `main.ts` (`NestExpressApplication`, Nest 10+) — les métadonnées textuelles n'ont jamais besoin de plus ; les uploads d'images gardent leur propre limite dédiée (10 Mo, `FileInterceptor`), non affectée.
- **Logs structurés** (`apps/api/src/common/logger/app-logger.service.ts`) : `AppLogger` implémente `LoggerService` et est branché via `app.useLogger(new AppLogger(isProduction))` dans `main.ts` — une ligne JSON par entrée en production, une ligne lisible en développement. Toute instance `new Logger(context)` créée ailleurs dans le code (le filtre d'erreurs existant, par exemple) délègue automatiquement à cette implémentation sans modification de ces call sites, Nest remplaçant le logger sous-jacent process-wide. Complété par `RequestLoggingInterceptor` (`apps/api/src/common/interceptors/request-logging.interceptor.ts`), enregistré globalement (`APP_INTERCEPTOR`), qui journalise chaque requête HTTP (méthode, chemin, statut, durée, `requestId`) — corrélé au middleware `RequestIdMiddleware` déjà en place depuis la Phase 2. Pas de dépendance externe (pino/winston) ajoutée : solution proportionnée au besoin réel, sans complexité de corrélation par `AsyncLocalStorage` non demandée par le PRD.
- **Documentation OpenAPI complète** : `@ApiOperation` et `@ApiResponse` (succès + erreurs) ajoutés sur les ~35 routes de tous les contrôleurs (`auth`, `households`, `categories`, `items`, `invitations` × 2, `uploads`, `stats`, `exports`, `health`) — auparavant seuls les DTO de requête étaient annotés (`@ApiProperty`), aucune route n'avait de réponse documentée. Décorateur partagé `ApiStandardErrors(...codes)` (`apps/api/src/common/swagger/api-standard-errors.decorator.ts`) pour éviter de dupliquer les mêmes `@ApiResponse` d'erreur standard (400/401/403/404/409/429) sur chaque contrôleur.
- **Export du contrat OpenAPI** : `apps/api/src/common/swagger/document.ts` centralise la construction du document (`DocumentBuilder`), partagée entre `main.ts` (Swagger UI en développement) et le nouveau script `apps/api/scripts/export-openapi.ts` (`pnpm --filter @notre-nid/api run export:openapi`), qui boote l'application Nest sans écouter de port et fige le contrat dans `docs/openapi.json` (26 routes). Le script utilise `ts-node` (nouvelle devDependency) plutôt que `tsx` (déjà utilisé pour le seed Prisma) : `tsx` repose sur `esbuild`, qui n'implémente pas `emitDecoratorMetadata` — la résolution par injection de dépendances de Nest (`ConfigService` dans `PrismaService`, notamment) échouait silencieusement (`configService: undefined`) sous `tsx`. Diagnostiqué en réactivant temporairement le logger Nest (masqué par `logger: false`) pour faire apparaître l'erreur réelle.
- **Vérification de cohérence du client API vs contrat OpenAPI** : `packages/api-client` reste un client manuscrit (décision de la Phase 3A, non remise en cause — réécrire un client déjà validé sans nécessité technique démontrable aurait été disproportionné). À la place : `openapi-typescript` génère des types (`src/generated/schema.d.ts`, `pnpm --filter @notre-nid/api-client run generate:types`) depuis `docs/openapi.json`, et `src/contract.ts` vérifie à la compilation (`pnpm typecheck`) que chaque route/méthode HTTP utilisée par `endpoints/*.ts` existe bien dans le contrat généré — toute dérive fait échouer `tsc`. Vérifié activement : une route délibérément cassée (`/auth/me` en `delete` au lieu de `get`) fait échouer le typecheck avec `TS2344: Type 'false' does not satisfy the constraint 'true'`, confirmant que le contrôle n'est pas vide de sens.
- **6 tests de rendu d'écran mobile manquants comblés** (dette technique documentée en Phase 3B) : `profile/members.test.tsx`, `profile/invitations.test.tsx`, `profile/categories.test.tsx`, `profile/archives.test.tsx`, `profile/join.test.tsx`, `profile/index.test.tsx` — 34 nouveaux cas de test (rendu chargé/vide/erreur, interactions de mutation clés : changement de rôle, retrait de membre, quitter le foyer, révocation d'invitation, CRUD catégorie, export JSON/CSV, déconnexion). Suivent les conventions déjà établies (`mockApiClient`, `queryWrapper`/`ThemeProvider`/`ToastProvider`, mock `expo-image` en `function` jamais en `class`).
- **CI GitHub Actions** (`.github/workflows/ci.yml`, inexistante avant cette phase) : un job unique sur push/PR vers `main`, avec des services PostgreSQL 16 et Mailpit (répliquant `docker-compose.yml`) — install, génération Prisma, `prisma validate`, format, lint, typecheck, `prisma migrate deploy`, tests unitaires, tests e2e, vérification que le seed s'exécute proprement, build, puis deux contrôles de fraîcheur (`export:openapi` + `git diff --exit-code` sur `docs/openapi.json` ; `generate:types` + `git diff --exit-code` sur le schéma généré) qui font échouer la CI si un contributeur change une route sans régénérer les artefacts commités. `expo-doctor` en dernière étape, non bloquant (`continue-on-error`) étant donné les deux écarts déjà documentés et acceptés (voir ci-dessous).
- **Correction de flakiness de tests mobiles** : deux fichiers différents (`ConfirmDialog.test.tsx`, puis `ItemFormScreen.test.tsx`, puis `NoHouseholdView.test.tsx` sur une 3ᵉ exécution) ont échoué tour à tour par dépassement du délai par défaut de 5 s sous charge parallèle complète (même symptôme déjà documenté en Phase 3B, mais touchant un fichier différent à chaque run — donc systémique, pas propre à un fichier). Corrigé une fois pour toutes via `testTimeout: 20000` dans `apps/mobile/jest.config.js` plutôt que d'ajouter des `jest.setTimeout()` au cas par cas (et les redondants déjà ajoutés par erreur ont été retirés).

### Fichiers principaux créés ou modifiés

- `apps/api/src/health/health.controller.ts`, `health.controller.spec.ts`.
- `apps/api/src/app.module.ts` (`ThrottlerModule`, `APP_GUARD`, `APP_INTERCEPTOR`), `apps/api/src/auth/auth.controller.ts` (`@Throttle`).
- `apps/api/src/main.ts` (`useBodyParser`, `useLogger`, Swagger factorisé).
- `apps/api/src/common/logger/app-logger.service.ts` (nouveau), `apps/api/src/common/interceptors/request-logging.interceptor.ts` (nouveau).
- `apps/api/src/common/swagger/document.ts` (nouveau), `api-standard-errors.decorator.ts` (nouveau).
- Tous les contrôleurs (`auth`, `households`, `categories`, `items`, `invitations`, `invitations-public`, `uploads`, `stats`, `exports`) : annotations Swagger.
- `apps/api/scripts/export-openapi.ts` (nouveau), `apps/api/package.json` (`export:openapi`, devDependency `ts-node`), `docs/openapi.json` (nouveau, généré).
- `apps/api/test/rate-limiting.e2e-spec.ts` (nouveau).
- `packages/api-client/package.json` (`generate:types`, devDependency `openapi-typescript`), `packages/api-client/src/generated/schema.d.ts` (nouveau, généré), `packages/api-client/src/contract.ts` (nouveau).
- `apps/mobile/src/app/(app)/profile/{members,invitations,categories,archives,join,index}.test.tsx` (nouveaux).
- `apps/mobile/jest.config.js` (`testTimeout`).
- `.github/workflows/ci.yml` (nouveau).
- `.prettierignore` (exclusion des fichiers générés : `docs/openapi.json`, `packages/api-client/src/generated/`, `apps/mobile/expo-env.d.ts`).
- `README.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/PHASE_STATUS.md`.

### Migrations ajoutées

Aucune — la Phase 4 n'a modifié ni le schéma Prisma ni le contrat des routes existantes (uniquement leur documentation et leur durcissement).

### Commandes réellement exécutées et leur résultat

| Commande | Résultat |
| --- | --- |
| `pnpm run format:check` | ✅ succès sur tout le monorepo (après formatage des fichiers manuscrits touchés ; fichiers générés exclus via `.prettierignore`) |
| `pnpm run lint` | ✅ succès sur les 4 packages, 0 avertissement (`--max-warnings 0` sur le mobile) |
| `pnpm run typecheck` | ✅ succès sur les 4 packages, zéro erreur — y compris `packages/api-client/src/contract.ts` (vérification de cohérence OpenAPI) |
| `pnpm --filter @notre-nid/api exec prisma validate` | ✅ schéma valide (inchangé) |
| `pnpm run test` | ✅ 146/146 tests unitaires (34 API + 8 api-client + 104 mobile) |
| `pnpm --filter @notre-nid/api run test:e2e` (contre PostgreSQL + Mailpit réels) | ✅ 14/14 tests e2e (13 existants + le nouveau test de rate limiting), aucune régression |
| `pnpm run build` | ✅ succès (`apps/api`, `packages/shared`, `packages/api-client`) |
| Démarrage réel du build (`node apps/api/dist/main.js`) + `curl /api/v1/health` et `/api/v1/health/ready` | ✅ 200 sur les deux, readiness confirmant une vraie requête base (processus arrêté proprement après vérification) |
| `pnpm --filter @notre-nid/api run export:openapi` | ✅ `docs/openapi.json` généré (26 routes) |
| `pnpm --filter @notre-nid/api-client run generate:types` | ✅ `src/generated/schema.d.ts` généré, cohérent avec `contract.ts` |
| `npx expo-doctor` (dans `apps/mobile`) | ⚠️ 18/21 — les deux écarts déjà documentés en Phase 3A/3B (metro.config.js personnalisé, dérive de versions patch), plus un nouveau : régression mémoire connue de Hermes V1 sur `expo@57.0.8` (voir « Problèmes rencontrés ») |

### Problèmes rencontrés et corrigés

- **`/health/ready` ne vérifiait jamais réellement la base de données** depuis sa création en Phase 1, malgré un commentaire de suivi jamais résolu en Phase 2 — voir ci-dessus, corrigé en tout premier.
- **`tsx` (esbuild) ne supporte pas `emitDecoratorMetadata`**, cassant silencieusement l'injection de dépendances de Nest (`ConfigService` non résolu, capturé comme `undefined`) dans le script d'export OpenAPI — le seed Prisma (`prisma/seed.ts`) fonctionne avec `tsx` car il n'utilise pas le conteneur de Nest, juste `PrismaClient` directement, d'où l'absence de ce problème ailleurs dans le dépôt. Corrigé en utilisant `ts-node` (véritable compilateur TypeScript, respecte `emitDecoratorMetadata`) uniquement pour ce script.
- **Flakiness de timeout de tests mobiles sous charge parallèle complète, touchant un fichier différent à chaque exécution** (`ConfirmDialog`, puis `ItemFormScreen`, puis `NoHouseholdView`) — confirmé non lié au contenu de ces tests (chacun passe systématiquement en isolation) mais à un délai de démarrage à froid des workers Jest sous forte charge. Corrigé globalement (`testTimeout: 20000` dans `jest.config.js`) plutôt que fichier par fichier, après avoir constaté que des corrections ponctuelles ne faisaient que déplacer le symptôme vers un autre fichier.
- **Régression mémoire connue de Hermes V1** signalée par une nouvelle vérification `expo-doctor` (absente de la référence Phase 3B à 18/20, cette session obtient 18/21 — un nouveau check a été ajouté par une version plus récente d'`expo-doctor`) : `expo@57.0.8` embarque une version de Hermes affectée par une régression mémoire connue, corrigée en `57.0.9+`. **Non corrigé dans cette session** : la Phase 3A a déjà documenté qu'une tentative de mise à jour des paquets Expo a provoqué une régression réelle du bundler Metro, annulée faute de pouvoir vérifier visuellement le résultat dans cet environnement (toujours vrai ici). Signalé explicitement plutôt que corrigé à l'aveugle — voir « Actions manuelles restantes ».
- **Import mal ordonné** (`import/order`) et **directive `eslint-disable` inutile** détectés par le lint après l'ajout des annotations Swagger et du test de rate limiting — corrigés immédiatement (pas d'avertissement toléré, conformément à la convention `--max-warnings 0` déjà en vigueur sur le mobile).

### Décisions prises

- **Pas de dépendance de logging externe** (pino/winston) pour les logs structurés : un `LoggerService` maison (`AppLogger`) suffit au besoin exprimé par le PRD (JSON en prod, lisible en dev, log d'accès par requête) sans complexité de corrélation par `AsyncLocalStorage` non demandée.
- **Rate limiting avec des seuils délibérément plus généreux qu'un idéal théorique de sécurité pure** (10 req/min sur les routes d'authentification plutôt que 3-5/min) : calibré pour ne jamais bloquer les suites e2e existantes (jusqu'à 7 appels `/auth/register` dans un seul fichier) tout en restant une protection réelle contre le bourrage automatisé — protection suffisante pour une application personnelle de ce profil de risque (voir la mise en garde du PRD contre la sur-ingénierie).
- **Client API non régénéré depuis OpenAPI, vérification de cohérence ajoutée à la place** : réécrire `packages/api-client` (validé et testé depuis la Phase 3A) en client généré aurait été une reconstruction sans nécessité technique démontrée, contraire à la consigne de consolidation de cette phase. La vérification compilée (`contract.ts`) atteint le même objectif de détection de dérive sans ce risque.
- **`ts-node` ajouté comme devDependency plutôt que de contourner autrement le problème `tsx`/`esbuild`** : alternative la plus directe et la mieux comprise pour un script ponctuel nécessitant le vrai compilateur TypeScript, sans toucher à la configuration `tsx` déjà utilisée ailleurs (seed Prisma).
- **Mise à jour des paquets Expo non tentée malgré la régression Hermes signalée** : cohérent avec la décision déjà prise en Phase 3A après une régression Metro réelle constatée lors d'une tentative similaire — préférer signaler clairement un risque plutôt que modifier des dépendances sans pouvoir vérifier visuellement le résultat.

### Actions manuelles restantes

- **Vérification visuelle sur simulateur/émulateur/appareil réel toujours non réalisée** — même limitation d'environnement que documentée en Phase 3A/3B (pas de simulateur iOS sous Windows, pas d'émulateur Android démarré, bug de résolution Metro/Expo CLI spécifique à Windows + pnpm + monorepo non ré-investigué). Recommandation inchangée : lancer `pnpm dev:mobile` depuis une machine macOS/Linux avant la Phase 5.
- **Mise à jour Expo vers `57.0.9+` pour corriger la régression mémoire Hermes V1** signalée par `expo-doctor` — à faire avec un test réel sur appareil/simulateur disponible, étant donné la régression Metro déjà rencontrée lors d'une tentative de mise à jour similaire en Phase 3A.
- **CI GitHub Actions non encore observée en exécution réelle sur GitHub** (`.github/workflows/ci.yml` ajouté et cohérent avec les commandes de validation locales, mais aucune pull request n'a encore déclenché le workflow au moment de cette session) — à confirmer verte à la prochaine pull request réelle.

### Prochaine étape recommandée

Les **Phases 1 à 4** sont maintenant complètes. Démarrer la **Phase 5 — Livraison** : Dockerfile multi-stage de production, stratégies de déploiement, sauvegardes, configuration EAS et guide de build mobile, documents restants (`ARCHITECTURE.md`, `API.md`, `OPERATIONS.md`, `ROADMAP.md`, `DECISIONS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`), checklist finale — voir `docs/IMPLEMENTATION_PLAN.md`. Traiter au préalable la mise à jour Expo (régression Hermes) si un environnement de test visuel devient disponible.

---

## Phase 3B — Mutations, administration et finalisation mobile

### Éléments terminés

- **Correctif de sécurité hérité de la Phase 2** : `InvitationsService.create`/`listForHousehold` renvoyaient `tokenHash` en clair dans la réponse HTTP (violation de la règle PRD « les réponses ne doivent jamais contenir de hash ou secret »). Corrigé via un mapper dédié (`invitations.mapper.ts`) avant toute autre modification de la Phase 3B, avec test de non-régression.
- **`packages/api-client`** étendu : support `FormData` (upload de fichier, sans `Content-Type` JSON) et réponses texte brut (`requestText`, pour l'export CSV) dans `http.ts` ; nouveaux endpoints `households` (rename/rôle/retrait/leave), `categories` (create/update/remove), `items` (create/update/archive/restore), `invitations` (list/create/revoke/accept), `uploads`, `exports`.
- **`packages/shared`** : types `HouseholdInvitation`/`HouseholdInvitationWithToken`, `HouseholdExportItem`.
- **Design system** : composant `ConfirmDialog` (prévu par le PRD, absent de la Phase 3A) — confirmation modale centrée avec état de chargement, réutilisé pour toutes les actions destructrices (archivage, retrait de membre, révocation d'invitation, suppression de catégorie) ; ajout d'une variante `danger` à `Button` plutôt que des styles ad hoc.
- **Hooks de mutation** (`apps/mobile/src/hooks`) : `useItemMutations` (create/update/archive/restore, avec invalidation ciblée items+stats et écriture directe du cache pour update/archive/restore), `useCategoryMutations`, `useMemberMutations`, `useInvitations` (liste + create/revoke/accept), `useUploads` (upload/suppression de couverture via `FormData`), `useExports` (récupération JSON/CSV + partage).
- **Formulaire d'ajout/modification d'un item** (`apps/mobile/src/screens/item-form/`) : assistant en 3 étapes (catégorie/titre/état/description/notes → métadonnées spécifiques livre/CD/DVD ou schéma dynamique d'une catégorie personnalisée → propriétaires + couverture + récapitulatif + confirmation), React Hook Form + Zod, mode création et modification partageant exactement le même composant (`ItemFormScreen`). `schema.ts` centralise le modèle de formulaire (tout en chaînes de caractères, converties vers les types API uniquement à la soumission) et la construction du payload par catégorie.
- **Couverture d'image** (`useCoverPicker`) : sélection via `expo-image-picker`, aperçu immédiat, upload réel, remplacement, suppression — ne conserve jamais un `file://` local comme référence persistante.
- **5ᵉ onglet « Ajouter »** (accent orange, `tabBarActiveTintColor`/`tabBarInactiveTintColor` forcés) et nouvelle route `/(app)/collection/edit/[itemId]`, toutes deux rendant `ItemFormScreen`.
- **Écran détail d'un item** : boutons « Modifier » (navigation vers l'édition) et « Archiver » (via `ConfirmDialog`) ; bouton « Restaurer » pour un item déjà archivé.
- **Restructuration de Profil en pile de navigation** (`app/(app)/profile/`) : `index` (profil, foyer courant, changement de foyer, exports JSON/CSV, déconnexion/déconnexion globale), `members` (changement de rôle via `BottomSheet` + `Chip`, retrait, « Quitter ce foyer »), `invitations` (création avec affichage du jeton de développement, liste, révocation), `categories` (CRUD catégories personnalisées avec éditeur de schéma de champs simple : libellé/type/requis), `archives` (liste infinie des items archivés, réutilise `ItemCard`), `join` (rejoindre un foyer par jeton). Toutes les actions d'administration sont conditionnées au rôle courant de l'utilisateur (`OWNER`/`ADMIN`), l'API restant l'autorité finale.
- **`AuthProvider`** : ajout de `logoutAllDevices()` (`POST /auth/logout-all`), avec test miroir de celui de `logout()`.
- **Export JSON/CSV** (`lib/exportFile.ts`) : écrit le contenu dans le cache local via l'API `File`/`Paths` d'`expo-file-system`, puis ouvre le panneau de partage natif (`expo-sharing`) ; `SharingUnavailableError` prévient explicitement l'utilisateur plutôt que de rapporter un succès muet si le partage n'est pas disponible sur la plateforme.
- **Correctif backend découvert en testant les nouveaux parcours de bout en bout contre l'API réelle** : la suppression d'une catégorie personnalisée encore référencée par un item renvoyait une erreur 500 brute (violation de contrainte de clé étrangère Postgres non interceptée) au lieu du message convivial attendu par le PRD (« erreurs liées aux catégories déjà utilisées »). `CategoriesService.remove` vérifie désormais le nombre d'items concernés avant de supprimer, et intercepte en filet de sécurité une éventuelle violation de contrainte au moment du `delete()` lui-même (avec une détection par message en repli, le code d'erreur Prisma n'étant pas toujours peuplé par l'adaptateur `@prisma/adapter-pg`).
- **Tests mobiles** : 43 nouveaux tests (67 au total, contre 24 en Phase 3A) — `ConfirmDialog`, chaque hook de mutation (avec un `ApiClient`/`QueryClient` mockés partagés via `test-utils/mockApiClient.ts` et `test-utils/queryWrapper.tsx`), `schema.ts` du formulaire d'item (14 tests couvrant la construction du payload par catégorie, la conversion inverse pour l'édition, et les champs personnalisés requis manquants), `lib/exportFile.ts`, et un test d'intégration de `ItemFormScreen` (blocage de la navigation tant que la validation échoue, parcours complet de création).
- **Tests API** : `invitations.service.spec.ts` (2 tests, non-fuite de `tokenHash`) et `categories.service.spec.ts` (7 tests, permissions/appartenance/catégorie en cours d'utilisation) — 33 tests unitaires au total contre 24 en Phase 3A ; les 13 tests e2e existants restent verts sans modification.

### Fichiers principaux créés ou modifiés

- `apps/api/src/invitations/invitations.mapper.ts` (nouveau), `invitations.service.ts`, `invitations.service.spec.ts` (nouveau).
- `apps/api/src/categories/categories.service.ts`, `categories.service.spec.ts` (nouveau).
- `packages/shared/src/types/{invitation,export}.ts` (nouveaux), `packages/shared/src/index.ts`.
- `packages/api-client/src/http.ts`, `http.spec.ts`, `client.ts`, `index.ts`, `src/endpoints/{households,categories,items}.ts`, `src/endpoints/{invitations,uploads,exports}.ts` (nouveaux).
- `apps/mobile/src/components/{ConfirmDialog,ConfirmDialog.test}.tsx` (nouveaux), `Button.tsx`, `index.ts`.
- `apps/mobile/src/hooks/{useItemMutations,useCategoryMutations,useMemberMutations,useInvitations,useUploads,useExports}.ts` (+ `.test.ts` associés).
- `apps/mobile/src/screens/item-form/` (nouveau dossier complet : `ItemFormScreen`, `StepBasics`, `StepMetadata`, `StepReview`, `useCoverPicker`, `metadataFields.ts`, `schema.ts` + tests).
- `apps/mobile/src/lib/{exportFile,exportFile.test}.ts` (nouveaux), `errorMessage.ts`, `queryKeys.ts`.
- `apps/mobile/src/constants/condition.ts` (ajout de `CONDITION_OPTIONS`).
- `apps/mobile/src/app/(app)/add.tsx` (nouveau), `_layout.tsx` (5ᵉ onglet).
- `apps/mobile/src/app/(app)/collection/{_layout,[itemId],index}.tsx`, `collection/edit/[itemId].tsx` (nouveau).
- `apps/mobile/src/app/(app)/profile/` (nouveau dossier remplaçant `profile.tsx` : `_layout`, `index`, `members`, `invitations`, `categories`, `archives`, `join`).
- `apps/mobile/src/providers/AuthProvider.tsx` (`logoutAllDevices`), `AuthProvider.test.tsx`.
- `apps/mobile/src/test-utils/{mockApiClient,queryWrapper}.tsx` (nouveaux).
- `apps/mobile/app.json`, `package.json` (`expo-image-picker`, `expo-file-system`, `expo-sharing`), `pnpm-lock.yaml`.

### Migrations ajoutées

Aucune — la Phase 3B n'a modifié ni le schéma Prisma ni le contrat des routes existantes (uniquement corrigé une fuite de champ interne et ajouté un cas d'erreur convivial déjà prévu par le contrat documenté).

### Commandes réellement exécutées et leur résultat

| Commande | Résultat |
| --- | --- |
| `pnpm -r --if-present run lint` | ✅ succès sur les 4 packages |
| `pnpm -r --if-present run typecheck` | ✅ succès sur les 4 packages, zéro erreur |
| `pnpm run format:check` | ✅ succès sur tout le monorepo |
| `pnpm --filter @notre-nid/api exec jest` | ✅ 33/33 tests unitaires |
| `pnpm --filter @notre-nid/api run test:e2e` (contre PostgreSQL réel) | ✅ 13/13 tests e2e, aucune régression |
| `pnpm --filter @notre-nid/api-client exec jest` | ✅ 8/8 tests |
| `pnpm --filter @notre-nid/mobile exec jest --forceExit` | ✅ 67/67 tests (exécuté 3 fois pour confirmer l'absence de flakiness) |
| `pnpm -r --if-present run build` | ✅ succès (`apps/api`, `packages/shared`, `packages/api-client` — `apps/mobile` n'a pas de script `build`, vérifié séparément via `expo-doctor`) |
| `pnpm --filter @notre-nid/api exec prisma validate` | ✅ schéma valide (inchangé) |
| `npx expo-doctor` (dans `apps/mobile`) | ✅ 18/20 — identique à la référence Phase 3A (les 2 échecs restants sont les mêmes déjà documentés : `metro.config.js` personnalisé attendu, dérive de versions patch Expo volontairement non corrigée) |
| Démarrage réel de l'API (`node dist/main.js`) + parcours complets via `curl` contre PostgreSQL et le seed réels : login, création de catégorie personnalisée, création d'un item à deux propriétaires avec métadonnées personnalisées, modification (propriétaires + notes), archivage, liste des archivés, restauration, upload d'une image PNG réelle (signature binaire valide), rattachement de la couverture à l'item, suppression de l'upload, création/liste/révocation d'invitation (vérification directe qu'aucun `tokenHash` n'apparaît dans la réponse), export JSON, export CSV, suppression d'une catégorie encore utilisée (409 convivial) puis après réaffectation de l'item (204) | ✅ tous les appels répondent avec les formes exactes attendues par les hooks mobiles ; a permis de détecter et corriger le bug de suppression de catégorie ci-dessus |

### Problèmes rencontrés et corrigés

- **Fuite de sécurité héritée de la Phase 2** (`tokenHash` dans les réponses d'invitation) — voir ci-dessus, corrigée avant tout autre travail de la Phase 3B.
- **Bug de suppression de catégorie en cours d'utilisation** (500 brut au lieu d'un 409 convivial) — découvert par les vérifications `curl` de bout en bout contre l'API réelle, corrigé et testé (voir ci-dessus).
- **Cache `.tsbuildinfo` obsolète empêchant `nest build` de régénérer `dist/`** (même symptôme que documenté en Phase 1, reproduit ici) : `deleteOutDir: true` supprime `dist/`, mais `tsc` en mode incrémental, se fiant à un `tsconfig.build.tsbuildinfo` pensant qu'aucun fichier n'a changé, ne réécrit alors rien — `dist/` reste absent malgré un build « réussi » sans erreur. Corrigé en supprimant `apps/api/tsconfig.build.tsbuildinfo` avant de reconstruire.
- **Duplication de dépendance native (`@expo/log-box`) après l'ajout d'`expo-image-picker`/`expo-file-system`/`expo-sharing`**, détectée par `expo-doctor` (20→17/20) : résolue par `pnpm dedupe`, sans changement de version d'aucun package Expo (donc sans risque de reproduire la régression Metro constatée en Phase 3A) — retour à 18/20.
- **`jest.mock()` retournant une `class` locale résout silencieusement en `undefined`** (piège spécifique à ce projet, documenté en mémoire persistante) : `babel-preset-expo` abaisse les `class` en motif `var`-hoisté, et `babel-plugin-jest-hoist` déplace le `require()` qui déclenche la factory *avant* cet initialiseur — capturé comme `undefined` sans erreur. Diagnostiqué via un harnais de débogage minimal en isolant `class` vs `function` vs primitives ; corrigé en utilisant des `function` plutôt que des `class` dans les factories `jest.mock('expo-file-system', …)`.
- **`jest.mock()` retournant une classe qui importe `expo-image`** (via le composant `ItemCard`/le barrel `components`) échoue à l'exécution (`observe.getIntegrations is not a function`, sondage d'intégration analytics interne à `expo-image` incompatible avec cet environnement Jest) : contourné par `jest.mock('expo-image', () => ({ Image: () => null }))` dans les tests qui importent le barrel de composants.
- **Premier test d'un fichier isolé dépassant le délai par défaut de 5 s** (surcoût de démarrage à froid du worker Jest, pas un test lent en soi) : confirmé bénin en relançant la suite complète (le fichier passe alors en quelques centaines de ms) ; un délai explicite a été ajouté au test concerné plutôt que de masquer le symptôme.

### Décisions prises

- **Formulaire de métadonnées entièrement en chaînes de caractères, converti vers les types API uniquement à la soumission** (`buildItemPayload`) plutôt qu'un schéma Zod dynamique par catégorie : évite la complexité d'unions discriminées pour des catégories personnalisées dont la forme n'est connue qu'à l'exécution, tout en respectant l'exigence React Hook Form + Zod du PRD sur la partie validée (titre, catégorie, état, propriétaires).
- **Champs personnalisés booléens représentés par une paire de `Chip` (« Oui »/« Non »)** plutôt qu'un nouveau composant `Switch` : réutilise le design system existant pour un besoin rare, cohérent avec le principe « pas de composant supplémentaire sans nécessité réelle ».
- **Formulaires nommés d'après leur action et étape locale (`step`) plutôt que des routes Expo Router séparées par étape** : le brouillon reste en mémoire pendant la session (conforme au PRD, qui n'exige pas de persistance au-delà de la session) sans complexité de navigation supplémentaire.
- **Restructuration de `profile.tsx` en pile (`profile/`) plutôt que garder un écran plat** : le PRD prévoit de nombreuses sous-sections (membres, invitations, catégories, archives, export) qui appellent naturellement des écrans poussés plutôt qu'un unique écran surchargé.
- **Jeton d'invitation affiché en clair dans l'interface après création** (développement uniquement, avec mention explicite) plutôt que masqué : miroir du choix déjà fait côté API (jeton renvoyé dans la réponse et loggé en développement), permet de tester le parcours d'acceptation sans service SMTP réel configuré côté mobile.
- **Écran Archives sans action de restauration directe dans la liste** : la restauration se fait depuis l'écran détail (déjà équipé), éviter de dupliquer cette logique dans deux écrans.

### Actions manuelles restantes

- **Vérification visuelle sur simulateur/émulateur/appareil réel toujours non réalisée** : même limitation d'environnement que documentée en Phase 3A (pas de simulateur iOS sous Windows, pas d'émulateur Android démarré, bug de résolution Metro/Expo CLI spécifique à Windows + pnpm + monorepo non ré-investigué ici — la décision de ne pas poursuivre ce chantier reste celle prise en Phase 3A). Tous les nouveaux parcours ont été vérifiés par : tests automatisés (121 tests au total sur le monorepo) et appels HTTP réels reproduisant exactement les requêtes que les hooks mobiles envoient (voir tableau ci-dessus). **Recommandation avant Phase 4** : lancer `pnpm dev:mobile` depuis une machine macOS/Linux ou après mise à jour d'Expo CLI, et parcourir manuellement les 20 étapes de vérification listées dans le prompt de lancement de la Phase 3B.
- **Aucun test de bout en bout au niveau écran pour `members.tsx`, `invitations.tsx`, `categories.tsx`, `archives.tsx`, `join.tsx` et `profile/index.tsx`** (seul `ItemFormScreen` a un test d'intégration complet) : la logique sous-jacente (chaque hook de mutation) est testée unitairement et vérifiée en direct contre l'API réelle, mais un test de rendu complet par écran n'a pas été ajouté par manque de temps dans cette session. Dette technique à combler en Phase 4 si un budget de test plus large est souhaité.
- **Note sans lien avec le code de ce dépôt** : la dépendance `dotenv` (transitivement utilisée par Prisma) affiche désormais un message publicitaire aléatoire au démarrage de certaines commandes CLI (`injected env (…) // tip: …`, mentionnant un service tiers `vestauth.com`). Vérifié : il s'agit d'un texte statique embarqué dans le paquet `dotenv@17.x` lui-même (pas une requête réseau ni un contenu dynamique), donc sans risque de sécurité direct pour ce projet, mais à surveiller si la pratique s'aggrave dans une future mise à jour.

### Prochaine étape recommandée

La **Phase 3** est maintenant complète (3A + 3B). Démarrer la **Phase 4 — Qualité** : couverture de tests élargie (notamment combler les tests d'écran manquants listés ci-dessus), documentation OpenAPI complète, client API généré depuis le contrat OpenAPI, CI GitHub Actions, sécurité (rate limiting sur l'authentification), logs structurés — voir `docs/IMPLEMENTATION_PLAN.md`.

---

## Phase 3A — Fondations mobiles et parcours de consultation

### Éléments terminés

- **`packages/shared`** : types de domaine miroir exact des réponses API (`PublicUser`, `Household`/`HouseholdWithRole`/`HouseholdMember`, `Category`/`CategoryFieldSchema`/`SYSTEM_CATEGORY_SLUGS`, `Item`/`BookMetadata`/`CdMetadata`/`DvdMetadata`/`ItemsQueryParams`, `PaginationMeta`/`PaginatedResult`, `ApiErrorBody`, `AuthResult`).
- **`packages/api-client`** : client HTTP typé indépendant de React Native — intercepteur de rafraîchissement de token à vol unique (single-flight), `ApiError`/`NetworkError` typés, endpoints `auth`/`households`/`categories`/`items`/`stats`. 6 tests unitaires (`http.spec.ts` : rattachement Bearer, mapping `ApiError`, encapsulation `NetworkError`, rafraîchissement puis nouvelle tentative, expiration de session si le rafraîchissement échoue, déduplication du rafraîchissement concurrent).
- **Thème « Notre Nid »** (`apps/mobile/src/theme`) : palette exacte du PRD (crème/vert forêt/orange automnal), grille d'espacement 4pt, typographie Nunito Sans (400/500/600, avec repli système), rayons organiques, élévations légères.
- **Design system** (`apps/mobile/src/components`, 17 composants) : `AppText`, `ScreenContainer`, `Button`, `IconButton`, `TextField`, `PasswordField`, `SearchField`, `Select`, `Chip`, `CategoryBadge`, `ConditionBadge`, `OwnerAvatarGroup`, `ItemCard`, `EmptyState`, `ErrorState`, `LoadingSkeleton`, `Toast`/`ToastProvider`, `BottomSheet` — états complets (default/pressed/focused/disabled/loading/error/selected pertinents), zones tactiles ≥ 44×44, aucune couleur/marge/taille de police écrite en dur.
- **Providers** (`apps/mobile/src/providers`) : `QueryProvider` (TanStack Query, pas de nouvelle tentative sur 401/403/404/409/422), `AuthProvider` (restauration de session via `useQuery` — dérive le statut `loading`/`authenticated`/`unauthenticated`/`restore-error` sans effet de bord synchrone, `login`/`register`/`logout`, expiration de session déclenchée par le client API), `HouseholdProvider` (sélection automatique si un seul household, restauration du dernier household utilisé depuis SecureStore, sinon écran de sélection).
- **Navigation Expo Router** : groupe `(auth)` (connexion/inscription, React Hook Form + Zod) et groupe `(app)` avec garde d'authentification/household (redirection, écran de chargement, sélection de household), 4 onglets stables (Accueil, Collection, Recherche, Profil — le 5ᵉ onglet « Ajouter » est réservé à la Phase 3B).
- **Écran Accueil** : statistiques réelles (`GET /households/:id/stats`), ajouts récents, raccourcis.
- **Écran Collection** : liste infinie (`useInfiniteQuery`), recherche avec debounce, panneau de filtres (catégorie/propriétaire/condition) et tri (`BottomSheet`), pull-to-refresh, squelettes de chargement, état vide, état d'erreur avec nouvelle tentative.
- **Écran Détail item** : couverture, catégorie, propriétaires, état, métadonnées spécifiques (livre/CD/DVD/catégorie personnalisée), notes, créateur/dates.
- **Écran Recherche globale** : recherche debouncée sur l'ensemble du household.
- **Écran Profil** : utilisateur courant, household courant, liste des membres, changement de foyer, déconnexion — lecture seule (gestion complète réservée à la Phase 3B).
- **Tests mobiles** (`apps/mobile/src/**/*.test.{ts,tsx}`, 8 suites/24 tests) : composants (`Button`, `ConditionBadge`, `ItemCard`, `EmptyState`, `ErrorState`), hook (`useDebouncedValue`), utilitaire (`getErrorMessage`), et `AuthProvider` (restauration réussie/échouée/en erreur réseau, connexion, déconnexion, expiration de session).
- **`apps/mobile/metro.config.js`** ajouté (absent depuis la Phase 1) : configuration Metro adaptée au monorepo pnpm (`watchFolders`, `nodeModulesPaths`), conforme à la documentation officielle Expo pour les monorepos.

### Fichiers principaux créés ou modifiés

- `packages/shared/src/types/*.ts`, `packages/shared/src/index.ts`.
- `packages/api-client/src/{errors,types,query-string,http,client}.ts`, `packages/api-client/src/endpoints/*.ts`, `packages/api-client/src/http.spec.ts`, `packages/api-client/jest.config.js`.
- `apps/mobile/src/theme/*.ts` (`colors`, `spacing`, `typography`, `elevation`, `ThemeProvider`).
- `apps/mobile/src/components/*.tsx` (17 composants + `index.ts`).
- `apps/mobile/src/providers/{QueryProvider,AuthProvider,HouseholdProvider}.tsx`.
- `apps/mobile/src/lib/{config,secureTokenStorage,lastHouseholdStorage,queryKeys,errorMessage}.ts`.
- `apps/mobile/src/hooks/{useHouseholds,useItems,useItem,useCategories,useStats,useMembers,useDebouncedValue}.ts`.
- `apps/mobile/src/screens/{HouseholdSelectView,NoHouseholdView}.tsx`.
- `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/app/(auth)/{_layout,login,register}.tsx`, `apps/mobile/src/app/(app)/{_layout,index,profile,search}.tsx`, `apps/mobile/src/app/(app)/collection/{_layout,index,[itemId]}.tsx`.
- `apps/mobile/src/{components,hooks,lib,providers}/*.test.{ts,tsx}`, `apps/mobile/src/test-utils/{renderWithTheme,mockItem}.ts(x)`.
- `apps/mobile/metro.config.js` (nouveau), `apps/mobile/jest.config.js`, `apps/mobile/tsconfig.json` (`types: ["jest"]`), `apps/mobile/eslint.config.js` (exclusion de `metro.config.js`).
- `apps/mobile/.env.example`, `apps/mobile/.env` (`EXPO_PUBLIC_API_URL`, non commité pour `.env`).

### Migrations ajoutées

Aucune — la Phase 3A n'a modifié ni le schéma Prisma ni le contrat API.

### Commandes réellement exécutées et leur résultat

| Commande | Résultat |
| --- | --- |
| `pnpm format` / `pnpm format:check` | ✅ succès sur tout le monorepo |
| `pnpm -r --if-present run lint` | ✅ succès sur les 4 packages (`apps/api`, `apps/mobile`, `packages/shared`, `packages/api-client`) |
| `pnpm -r --if-present run typecheck` | ✅ succès sur les 4 packages, zéro erreur |
| `pnpm -r --if-present run test` | ✅ 54/54 tests (24 `apps/api`, 6 `packages/api-client`, 24 `apps/mobile`) |
| `pnpm -r --if-present run build` | ✅ succès (`apps/api`, `packages/shared`, `packages/api-client`) |
| `pnpm --filter @notre-nid/api exec prisma validate` | ✅ schéma valide (inchangé) |
| `npx expo-doctor` (dans `apps/mobile`) | ⚠️ 18/20 — voir « Problèmes rencontrés » : dérive de versions patch Expo (acceptée, non bloquante) et avertissement générique sur la présence d'un `metro.config.js` personnalisé (attendu, conforme à la doc Expo monorepo) |
| Démarrage de l'API (`node dist/main.js`) + parcours réel via `curl` : `/health`, `/health/ready`, `login` (compte de démonstration), `households`, `stats`, `items` (pagination/recherche/filtre par condition), détail d'un item, `refresh`, erreur d'identifiants invalides | ✅ tous les appels répondent avec les formes exactes attendues par les hooks mobiles |
| `npx expo start` / `npx expo start --web` / `npx expo export --platform ios` (vérification du bundle applicatif) | ❌ échec reproductible — voir « Problèmes rencontrés » |

### Problèmes rencontrés et corrigés

- **5 problèmes de lint découverts en fin d'implémentation** : `Array<T>` au lieu de `T[]` (corrigé), imports dupliqués `import/no-duplicates` dans `AuthProvider.tsx` (fusionnés), et surtout **deux erreurs `react-hooks/set-state-in-effect`** (règle du compilateur React, plus stricte que les règles classiques) : `AuthProvider` appelait `setStatus` de façon synchrone dans un effet de montage, `HouseholdProvider` appelait `setHouseholdId` de façon synchrone dans l'effet de sélection automatique. **Corrigé en profondeur plutôt que masqué** : la restauration de session a été migrée vers `useQuery` (TanStack Query gère l'effet en interne, hors de portée du linter applicatif) ; la sélection de household a été migrée vers un `householdId` dérivé par `useMemo` à partir de l'état des households/de la sélection manuelle/du dernier household persisté, avec un effet séparé ne faisant que persister ce choix (aucun appel `setState`).
- **`@testing-library/react-native` v14 est intégralement asynchrone** (changement de comportement non documenté rencontré en pratique) : `render`, `rerender`, `unmount`, `renderHook` et `fireEvent.*` renvoient désormais des `Promise` (auparavant synchrones). Tous les tests ont dû être écrits avec `await`. Découvert car les premiers tests échouaient avec des erreurs trompeuses (« render function has not been called », `result` `undefined`) tant que cette exigence n'était pas comprise.
- **`jest-expo` nécessite `@react-native/jest-preset`** comme dépendance explicite désormais séparée (non incluse automatiquement) — ajoutée en `devDependency` de `apps/mobile`.
- **`@types/jest` non résolu par TypeScript** malgré son installation : nécessite `"types": ["jest"]` explicite dans `tsconfig.json` de `apps/mobile` et `packages/api-client` (l'inclusion automatique des paquets `@types/*` ne se produisait pas dans cette configuration monorepo).
- **Conflit de version `jest-mock`/`jest-environment-node` entre `apps/api`/`packages/api-client` (jest 30) et `@react-native/jest-preset` (jest 29, transitif via `apps/mobile`)** : dans une installation pnpm stricte, `apps/api` et `packages/api-client` ne déclarant pas explicitement `jest-environment-node`, la résolution du testEnvironment de Jest 30 pouvait retomber sur la copie 29.7.0 apportée par la chaîne de dépendances d'Expo, provoquant `TypeError: this._moduleMocker.clearMocksOnScope is not a function`. **Corrigé** en épinglant `"jest-environment-node": "30.4.1"` comme `devDependency` explicite de `apps/api` et `packages/api-client`, forçant une résolution locale correcte indépendamment de ce qui est présent ailleurs dans le monorepo.
- **Tentative de mise à jour des versions Expo (`expo`, `expo-router`, `react-native`, etc.) vers les derniers correctifs pour satisfaire `expo-doctor`** : cette mise à jour a introduit une régression réelle du bundler Metro (`Unable to resolve module react-native-safe-area-context` puis d'autres erreurs de résolution). **Annulée** (retour aux versions précédentes, qui fonctionnaient) — une alerte cosmétique d'`expo-doctor` sur des versions patch ne justifiait pas de risquer une régression fonctionnelle réelle. Les 7 paquets restent donc légèrement en retard sur les derniers correctifs Expo SDK 57 ; `@types/jest` reste volontairement sur `30.0.0` (cohérence avec `jest` 30 utilisé dans tout le monorepo) via `"expo": { "install": { "exclude": ["@types/jest"] } }`.
- **Bug de résolution de module Metro/Expo CLI spécifique à cet environnement (Windows + pnpm + monorepo), non résolu** : `npx expo start`, `npx expo start --web` et `npx expo export --platform ios` échouent tous de façon reproductible — même après un cache entièrement vidé (`.expo`, `node_modules/.cache`, cache Metro au niveau du système d'exploitation) et après l'ajout d'un `metro.config.js` conforme aux recommandations officielles d'Expo pour les monorepos — avec des erreurs telles que `Unable to resolve module ./apps/mobile/node_modules/expo-router/entry from <racine du monorepo>/.` ou `Cannot read properties of undefined (reading 'get')` dans `metro/src/node-haste/DependencyGraph.js`. Le serveur Metro démarre correctement (`Waiting on http://localhost:8081`, `/status` répond `packager-status:running`) mais échoue précisément lors du chargement du module d'entrée via le protocole de manifeste moderne d'Expo (`getStaticPageAsync`/`ssrLoadModuleContents`), qui sert à la fois le rendu web statique et la construction du bundle natif. **Non corrigé** : ce point ne relève pas du code de l'application (`tsc` ne rapporte aucune erreur sur l'intégralité du code mobile) mais d'une interaction entre outils (Expo CLI/Metro, pnpm, Windows) — **vérification manuelle indispensable avant la Phase 3B**, idéalement sur une autre machine (macOS/Linux) ou après mise à jour d'Expo CLI.
- **Incident de synchronisation OneDrive ayant corrompu silencieusement plusieurs fichiers du dépôt de travail** : le dépôt se trouve dans un dossier synchronisé OneDrive ; des cycles rapides de suppression/réinstallation de dépendances (`rm -rf node_modules/.cache`, `.expo`, réinstallations successives) ont créé une course avec la synchronisation en temps réel de OneDrive, qui a silencieusement remplacé le contenu de plusieurs fichiers suivis (`packages/api-client/src/index.ts`, `packages/shared/src/index.ts`, `packages/api-client/package.json`/`tsconfig.json`, `packages/shared/package.json`, `apps/mobile/package.json`/`app.json`/`src/app/_layout.tsx`) par un contenu ancien (squelette de Phase 1), tout en déposant le contenu récent dans des copies de conflit `*-Camarade.*` (supprimées par erreur avant que leur signification ne soit comprise). **Détecté** car `tsc` a commencé à signaler des exports manquants sur des modules pourtant implémentés. **Corrigé sans perte** : l'historique Git (commits `4376ae7` et `6e55e03`, déjà réalisés séparément par le propriétaire du dépôt) contenait la version correcte de chaque fichier concerné ; restauration ciblée via `git checkout HEAD -- <fichiers>`, puis reconstruction des paquets et réapplication des ajustements réalisés après ces commits (voir points ci-dessus). Chaque fichier modifié a été vérifié individuellement (diff contre `HEAD`) avant toute décision de restauration ou de conservation, pour ne pas écraser du travail légitime.

### Décisions prises

- **4 onglets seulement en Phase 3A** (Accueil, Collection, Recherche, Profil) — le 5ᵉ onglet « Ajouter » (visuellement accentué en orange selon le PRD) est différé à la Phase 3B, faute de formulaire de mutation à cette étape.
- **Restauration de session modélisée via TanStack Query plutôt qu'un `useEffect` manuel** : élimine intrinsèquement l'anti-pattern « setState synchrone dans un effet », réutilise la gestion d'état de chargement/erreur déjà en place pour toutes les autres requêtes serveur, cohérent avec le reste de l'application.
- **Sélection de household dérivée (`useMemo`) plutôt que pilotée par effet** : le household actif est une fonction pure de (households disponibles, sélection manuelle, dernier household persisté) — recalculée à chaque rendu sans effet de bord, la persistance sur disque étant un effet séparé qui n'affecte jamais l'état React.
- **Aucune tentative supplémentaire de correction du bug Metro/Expo CLI au-delà du diagnostic** : la piste (bug d'interaction Expo CLI/monorepo/Windows) a été investiguée en profondeur (cache vidé à tous les niveaux, `metro.config.js` conforme, versions de dépendances vérifiées) sans succès ; poursuivre aurait consommé un temps disproportionné pour un problème d'environnement, non de code applicatif.

### Actions manuelles restantes

- **Vérifier visuellement l'application sur un simulateur/émulateur/téléphone réel** : non réalisable dans cet environnement (pas de simulateur iOS sous Windows, pas d'émulateur Android démarré). Lancer `pnpm dev:mobile` (ou `npx expo start` dans `apps/mobile`) depuis une machine où Expo Go ou un émulateur est disponible, et vérifier en particulier le bug de résolution Metro documenté ci-dessus avant de considérer la Phase 3B.
- **Mettre à jour les paquets Expo (`expo`, `expo-router`, `expo-constants`, `expo-linking`, `expo-system-ui`, `react-native`) vers les derniers correctifs** une fois le bug Metro élucidé, pour satisfaire complètement `expo-doctor` — non fait ici après la régression constatée lors de la tentative.

### Prochaine étape recommandée

Ne pas démarrer la **Phase 3B — Mutations, administration et finalisation mobile** avant que le propriétaire du dépôt ait pu vérifier manuellement l'application sur un appareil réel ou un émulateur (voir « Actions manuelles restantes »). Une fois cette vérification faite, la Phase 3B pourra couvrir : ajout d'item (formulaire multi-étapes), modification, upload de couverture, archivage/restauration, gestion des membres et invitations, gestion des catégories personnalisées, exports, profil/paramètres complets, et la finalisation des tests de la Phase 3.

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
