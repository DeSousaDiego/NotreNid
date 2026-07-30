# Plan d'implémentation — Notre Nid

Ce document décrit l'ordre des phases, leurs dépendances, leurs critères de sortie et les commandes de validation, conformément à `docs/NOTRE_NID_PRD.md` (sections 26 et 28). Il est mis à jour à chaque changement de périmètre ; l'état d'avancement réel est dans [PHASE_STATUS.md](PHASE_STATUS.md).

## Ordre des phases

1. **Phase 1 — Fondation** ✅ terminée
2. **Phase 2 — Backend métier** ✅ terminée
3. **Phase 3 — Mobile**
4. **Phase 4 — Qualité**
5. **Phase 5 — Livraison**

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

**Contenu** : système de thème centralisé (tokens de couleur/typographie/espacement — section 4), navigation à cinq destinations (Accueil, Collection, Ajouter, Recherche, Profil), état d'authentification (SecureStore, refresh automatique), sélection de household, écrans Accueil/Collection/Détail/Ajout (multi-étapes)/Profil, gestion des erreurs réseau et états vides/chargement.

**Dépendances** : Phase 2 terminée (l'API doit exposer les routes consommées par le mobile).

**Critères de sortie** : parcours principaux navigables sur un simulateur/émulateur, formulaire d'ajout fonctionnel bout en bout contre l'API locale, `pnpm lint`/`typecheck`/`test`/`build` verts.

---

## Phase 4 — Qualité

**Contenu** : couverture de tests élargie (unitaire + intégration API, composants/formulaires mobile), documentation OpenAPI complète, client API généré depuis le contrat OpenAPI, CI GitHub Actions (lint, typecheck, tests, build, service PostgreSQL), sécurité (rate limiting auth, helmet déjà en place, CORS configurable, limites de taille de requête), logs structurés, endpoints de santé déjà présents depuis la Phase 1.

**Dépendances** : Phases 2 et 3 terminées (il faut du code métier à tester et documenter).

**Critères de sortie** : CI verte sur une pull request de test, couverture des règles d'autorisation et d'isolation testée explicitement.

---

## Phase 5 — Livraison

**Contenu** : Dockerfile multi-stage de production, stratégies de déploiement documentées (`docs/DEPLOYMENT.md`), sauvegardes (`docs/BACKUP_AND_RESTORE.md`), configuration EAS et guide de build mobile (`docs/MOBILE_RELEASE.md`), documents restants de la section 25 du PRD (`ARCHITECTURE.md`, `API.md`, `OPERATIONS.md`, `ROADMAP.md`, `DECISIONS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`), checklist finale (`docs/GO_LIVE_CHECKLIST.md`).

**Dépendances** : Phases 2 à 4 terminées.

**Opérations nécessitant systématiquement une intervention humaine** (non automatisables par Claude Code) : achat de nom de domaine, création de la base de données managée, création du service d'hébergement API, création du bucket de stockage, création des secrets de production, création du compte Expo, choix des identifiants Android/iOS, création des comptes Google Play / Apple Developer, configuration des sauvegardes et alertes de production, premier build mobile réel, tests sur appareils physiques, acceptation des coûts des services choisis.

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
