# Plan d'implémentation — Notre Nid

Ce document décrit l'ordre des phases, leurs dépendances, leurs critères de sortie et les commandes de validation, conformément à `docs/NOTRE_NID_PRD.md` (sections 26 et 28). Il est mis à jour à chaque changement de périmètre ; l'état d'avancement réel est dans [PHASE_STATUS.md](PHASE_STATUS.md).

## Ordre des phases

1. **Phase 1 — Fondation** ✅ terminée
2. **Phase 2 — Backend métier** ✅ terminée
3. **Phase 3 — Mobile** ✅ terminée (découpée en deux sous-phases pour réduire les risques)
   - **Phase 3A — Fondations mobiles et parcours de consultation** ✅ terminée
   - **Phase 3B — Mutations, administration et finalisation mobile** ✅ terminée
4. **Phase 4 — Qualité** ✅ terminée
5. **Phase 5 — Livraison** ✅ terminée

Les Phases 1 à 5 sont **terminées** et validées. Le développement de la V1 est complet ; la mise en production réelle reste une action manuelle du propriétaire du dépôt — voir `docs/GO_LIVE_CHECKLIST.md`.

Chaque phase dépend de la précédente. Aucune phase ne doit démarrer avant que la précédente ait ses commandes de validation vertes (lint, typecheck, tests, builds).

---

## Phase 1 — Fondation ✅

**Contenu** : monorepo pnpm, configuration TypeScript strict, ESLint/Prettier/EditorConfig, Docker (PostgreSQL/Mailpit/MinIO), squelette API NestJS (`/health`, `/health/ready`), Prisma initialisé (schéma sans modèle), squelette mobile Expo Router, packages partagés (`shared`, `api-client`, `config`, `eslint-config`).

**Critères de sortie** (tous validés — voir PHASE_STATUS.md) :

- `pnpm install` réussit depuis un clone propre.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` passent sans erreur sur tout le monorepo.
- L'API démarre et répond `200` sur `GET /api/v1/health` et `GET /api/v1/health/ready`.
- `pnpm db:generate` génère le client Prisma sans erreur.
- L'application mobile s'exporte sans erreur (`expo export`) et passe `expo-doctor` (20/20).

**Dépendances externes non vérifiables dans cette phase** : Docker Desktop doit être installé et démarré par le propriétaire du dépôt (non détecté dans l'environnement d'implémentation — voir PHASE_STATUS.md).

---

## Phase 2 — Backend métier ✅

**Statut** : terminée et validée — voir `docs/PHASE_STATUS.md` pour le détail complet (fichiers, commandes exécutées, décisions, problèmes rencontrés et corrigés).

**Contenu** :

- Modèle de données Prisma complet (`User`, `Household`, `HouseholdMember`, `HouseholdInvitation`, `Category`, `Item`, `ItemOwner`, `BookMetadata`, `CdMetadata`, `DvdMetadata`, `RefreshSession`, `AuditLog` — section 5 du PRD).
- Première migration Prisma + script de seed (deux utilisateurs de démonstration, un household commun, catégories système, items variés — section 14).
- Authentification (inscription, connexion, refresh token révocable, déconnexion, Argon2 — sections 2, 3, 6).
- Households, membres, invitations (avec lien d'invitation exposé en développement uniquement — section 7).
- Catégories système + personnalisées.
- Items, propriétaires multiples (relation `ItemOwner`, jamais un simple `ownerId`).
- Recherche (insensible à la casse, sans Elasticsearch — section 8).
- Uploads d'images (stockage local en dev, abstraction S3-compatible — section 10).
- Statistiques et exports JSON/CSV.
- Vérification systématique de l'appartenance au household sur chaque route (isolation stricte).

**Dépendances** : Phase 1 terminée (API, Prisma, Docker Compose disponibles).

**Critères de sortie** (tous validés) :

- ✅ Migration appliquée avec succès sur une base PostgreSQL locale, y compris depuis une base entièrement réinitialisée (`prisma migrate reset --force`, avec confirmation explicite de l'utilisateur).
- ✅ Seed exécuté sans erreur (idempotent).
- ✅ Tests d'autorisation couvrant explicitement le cas critique : un membre du household A ne peut jamais lire, modifier ou supprimer un item du household B (test e2e dédié, contre PostgreSQL réel).
- ✅ `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` verts sur tout le monorepo.
- ✅ Endpoints de la section 7 du PRD tous exposés et documentés dans Swagger (`/api/v1/docs`, 26 routes, 15 schémas).

**Opérations nécessitant une intervention humaine** : aucune pour le développement local ; un service SMTP réel (au-delà de Mailpit) et un bucket S3 réel restent nécessaires uniquement pour la production (Phase 5).

---

## Phase 3 — Mobile

La Phase 3 est découpée en deux sous-phases afin de réduire les risques et de permettre une validation sérieuse des fondations avant d'implémenter toutes les mutations.

### Phase 3A — Fondations mobiles et parcours de consultation ✅

**Statut** : terminée et validée — voir `docs/PHASE_STATUS.md` pour le détail complet.

**Contenu** : système de thème centralisé (tokens couleur/typographie/espacement — section 4), design system de 17+ composants de consultation, client API typé complet (`packages/api-client`), types de domaine partagés (`packages/shared`), navigation Expo Router ((auth) + (app) à 4 onglets, garde d'authentification/household), état d'authentification (SecureStore, restauration de session via TanStack Query, refresh automatique, expiration de session), sélection/mémorisation du household, écrans Accueil (stats + ajouts récents), Collection (liste infinie, recherche, filtres, tri), Détail item (livre/CD/DVD/catégorie personnalisée), Recherche globale, Profil (lecture seule) + déconnexion, gestion des erreurs réseau et états vides/chargement/erreur, premiers tests mobiles (composants, hooks, provider d'authentification).

**Dépendances** : Phase 2 terminée (l'API doit exposer les routes consommées par le mobile).

**Critères de sortie** (tous validés) :

- ✅ `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` verts sur tout le monorepo.
- ✅ Connexion réelle à l'API (comptes de démonstration, vérifié via requêtes HTTP directes contre l'API locale démarrée avec Docker + le seed).
- ✅ Restauration/expiration de session, sélection de household, Accueil, Collection (recherche/filtres/tri/pagination), détail d'item, recherche globale : logique vérifiée par tests automatisés et par appels HTTP réels reproduisant chaque flux consommé par le mobile.
- ⚠️ Vérification visuelle sur un simulateur/émulateur/téléphone réel **non réalisée** : aucun simulateur iOS (Windows), aucun émulateur Android disponible dans l'environnement d'exécution. De plus, le serveur de développement Metro (`expo start`) rencontre un bug de résolution de module spécifique à cet environnement (Windows + pnpm + monorepo) qui empêche de servir le bundle applicatif via le protocole de manifeste moderne d'Expo — voir `docs/PHASE_STATUS.md` pour la reproduction complète. Ce point doit être vérifié manuellement par le propriétaire du dépôt sur sa propre machine avant la Phase 3B.

**Fonctionnalités explicitement préparées mais non implémentées (réservées à la Phase 3B)** : ajout d'item, modification d'item, upload/remplacement de couverture, archivage/restauration, gestion complète des membres, création/révocation d'invitations, gestion des catégories personnalisées, exports JSON/CSV, profil/paramètres avancés. Aucun bouton actif ni écran factice ne laisse croire que ces fonctionnalités sont disponibles.

### Phase 3B — Mutations, administration et finalisation mobile ✅

**Statut** : terminée et validée — voir `docs/PHASE_STATUS.md` pour le détail complet.

**Contenu** : formulaire d'ajout/modification d'item en 3 étapes (réutilisant le même composant pour les deux modes), upload/remplacement/suppression de couverture (`expo-image-picker` + l'API réelle), archivage/restauration, gestion des membres (rôles, retrait, quitter) et invitations (création/liste/révocation/acceptation par jeton), gestion des catégories personnalisées (CRUD + schéma de champs simple), exports JSON/CSV avec partage natif (`expo-file-system` + `expo-sharing`), Profil restructuré en pile de navigation, 5ᵉ onglet « Ajouter », 43 nouveaux tests mobiles + 9 nouveaux tests API. Corrige au passage une fuite de sécurité héritée de la Phase 2 (`tokenHash` exposé par les endpoints d'invitation) et un bug de suppression de catégorie (500 au lieu d'un message convivial), tous deux découverts et corrigés durant cette phase.

**Dépendances** : Phase 3A terminée et validée (c'est le cas).

**Critères de sortie** (tous validés) :

- ✅ Parcours de mutation complets navigables et fonctionnels contre l'API réelle — vérifiés à la fois par 121 tests automatisés sur le monorepo et par des appels HTTP réels reproduisant chaque requête envoyée par les hooks mobiles (households/categories/items/invitations/uploads/exports, contre PostgreSQL réel et le seed).
- ✅ `pnpm lint`/`typecheck`/`format:check`/`test`/`build` verts sur tout le monorepo.
- ⚠️ Vérification visuelle sur simulateur/émulateur/appareil réel **non réalisée**, pour la même raison qu'en Phase 3A (aucun simulateur/émulateur disponible dans cet environnement, bug de résolution Metro/Expo CLI Windows + pnpm + monorepo non ré-investigué) — à faire par le propriétaire du dépôt avant la Phase 4 ou la livraison.

**Dette technique documentée** : pas de test de rendu d'écran complet pour `members`/`invitations`/`categories`/`archives`/`join`/`profile/index` (seul `ItemFormScreen` en a un) — la logique de mutation sous-jacente est testée unitairement et vérifiée en direct contre l'API, mais un test d'intégration par écran reste à ajouter en Phase 4 si souhaité.

---

## Phase 4 — Qualité ✅

**Statut** : terminée et validée — voir `docs/PHASE_STATUS.md` pour le détail complet.

**Contenu** : couverture de tests élargie (6 tests de rendu d'écran mobile manquants comblés, test e2e de rate limiting), documentation OpenAPI complète (`@ApiOperation`/`@ApiResponse` sur tous les contrôleurs, export figé dans `docs/openapi.json`), vérification de cohérence du client API manuscrit contre ce contrat (types générés via `openapi-typescript`, contrôle compilé), CI GitHub Actions (`.github/workflows/ci.yml` : install, format, lint, typecheck, build, tests unitaires + e2e avec services PostgreSQL/Mailpit, validation Prisma, fraîcheur des artefacts générés), sécurité (rate limiting `@nestjs/throttler` sur l'authentification, limite de taille de corps JSON/urlencoded, helmet et CORS déjà en place), logs structurés (JSON en production, lisibles en développement, log d'accès corrélé au `requestId` déjà existant), correction d'un bug découvert en auditant les endpoints de santé (`/health/ready` ne vérifiait jamais réellement la base de données malgré un commentaire l'annonçant depuis la Phase 2).

**Dépendances** : Phases 2 et 3 terminées (il faut du code métier à tester et documenter).

**Critères de sortie** (tous validés) :

- ✅ `pnpm lint`/`typecheck`/`format:check`/`test`/`build` verts sur tout le monorepo (146 tests unitaires : 34 API + 8 api-client + 104 mobile).
- ✅ `pnpm --filter @notre-nid/api run test:e2e` vert (14 tests, dont le nouveau test de rate limiting) contre PostgreSQL et Mailpit réels.
- ✅ CI GitHub Actions ajoutée et cohérente avec les commandes de validation locales (non encore observée verte sur une pull request réelle, la CI n'ayant pas encore tourné sur GitHub au moment de cette session — à confirmer à la prochaine pull request).
- ✅ Couverture des règles d'autorisation et d'isolation déjà testée explicitement depuis la Phase 2, complétée par le test de rate limiting.

**Limite connue signalée, non corrigée** : `expo-doctor` (mobile) signale une régression mémoire connue de Hermes V1 dans `expo@57.0.8` (corrigée en `57.0.9+`) — non appliquée par prudence, cet environnement ne permettant pas de vérifier visuellement une mise à jour Expo (voir Phase 3A/3B pour la régression Metro déjà rencontrée lors d'une tentative similaire). À traiter avant la Phase 5, avec un test sur appareil réel.

---

## Phase 5 — Livraison ✅

**Statut** : terminée et validée — voir `docs/PHASE_STATUS.md` pour le détail complet.

**Contenu** : driver de stockage S3-compatible (comble un écart avec la section 10 du PRD, `STORAGE_DRIVER=s3` était déclaré mais non implémenté depuis la Phase 2), Dockerfile multi-stage de production (`infrastructure/docker/api/Dockerfile`, cibles `runtime`/`migrate`), script de sauvegarde PostgreSQL (`infrastructure/scripts/backup-postgres.sh`), commande `db:migrate:deploy`, stratégies de déploiement documentées (`docs/DEPLOYMENT.md`), sauvegardes (`docs/BACKUP_AND_RESTORE.md`), configuration EAS (`apps/mobile/eas.json`) et guide de build mobile (`docs/MOBILE_RELEASE.md`), documents restants de la section 25 du PRD (`docs/ARCHITECTURE.md`, `docs/API.md`, `docs/OPERATIONS.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`), checklist finale (`docs/GO_LIVE_CHECKLIST.md`).

**Dépendances** : Phases 2 à 4 terminées (c'est le cas).

**Critères de sortie** (tous validés) :

- ✅ `pnpm format:check`/`lint`/`typecheck`/`test`/`build` verts sur tout le monorepo (158 tests unitaires : 46 API + 8 api-client + 104 mobile — 12 nouveaux tests pour le driver de stockage S3/local).
- ✅ `pnpm --filter @notre-nid/api exec prisma validate` : schéma valide (inchangé).
- ⚠️ `docker build -f infrastructure/docker/api/Dockerfile .` **non vérifié** dans l'environnement d'implémentation : le moteur Docker Desktop renvoyait une erreur `500 Internal Server Error` de façon persistante — voir `docs/PHASE_STATUS.md`. Chaque commande du Dockerfile a en revanche été rejouée manuellement hors Docker (déploiement `pnpm deploy --prod`, régénération du client Prisma, démarrage réel de `dist/main.js`, vérification `/health` et `/health/ready`) — un bug réel a été trouvé et corrigé grâce à cette vérification. Le build Docker lui-même reste à exécuter avant tout déploiement réel (commande dans `docs/GO_LIVE_CHECKLIST.md`).
- ⚠️ Aucun build EAS produit (aucun compte Expo dans cet environnement) — voir `docs/MOBILE_RELEASE.md`.

**Opérations nécessitant systématiquement une intervention humaine** (non automatisables par Claude Code) : achat de nom de domaine, création de la base de données managée, création du service d'hébergement API, création du bucket de stockage, création des secrets de production, création du compte Expo, choix des identifiants Android/iOS, création des comptes Google Play / Apple Developer, configuration des sauvegardes et alertes de production, premier build mobile réel, tests sur appareils physiques, acceptation des coûts des services choisis — détail complet avec valeurs et commandes exactes dans `docs/GO_LIVE_CHECKLIST.md`.

---

## Commandes de validation (toutes phases)

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

À exécuter et corriger avant de considérer une phase comme terminée, conformément à `CLAUDE.md`.
