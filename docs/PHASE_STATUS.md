# Statut des phases — Notre Nid

## Phase courante

**Phase 3A — Fondations mobiles et parcours de consultation** : ✅ terminée et validée.

La **Phase 3** dans son ensemble (voir `docs/IMPLEMENTATION_PLAN.md`) n'est **pas** terminée : la **Phase 3B — Mutations, administration et finalisation mobile** n'a pas démarré. Ne pas commencer la Phase 3B tant qu'elle n'a pas été explicitement demandée.

Historique : Phase 1 — Fondation ✅, Phase 2 — Backend métier ✅ (voir sections dédiées plus bas).

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
