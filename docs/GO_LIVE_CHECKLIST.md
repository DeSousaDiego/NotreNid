# Checklist de mise en ligne — Notre Nid

Distingue strictement ce qui est déjà automatisé/prêt dans le dépôt de ce qui reste à faire manuellement par le propriétaire du dépôt. Rien de ce qui suit dans « À faire manuellement » n'a été exécuté par Claude Code (aucun compte externe, secret réel, ressource cloud payante ou publication sur un store n'a été créé — voir `CLAUDE.md`).

## Déjà automatisé dans le dépôt

- Code applicatif complet (API + mobile), phases 1 à 5 — voir `docs/PHASE_STATUS.md`.
- Schéma Prisma + migration initiale (`apps/api/prisma/migrations/`), script de seed idempotent.
- Driver de stockage S3-compatible et driver local, sélectionnables par variable d'environnement (`apps/api/src/uploads/storage/`).
- `Dockerfile` de production multi-stage (`infrastructure/docker/api/Dockerfile`, cibles `runtime` et `migrate`), `.dockerignore`.
- Script de sauvegarde PostgreSQL (`infrastructure/scripts/backup-postgres.sh`) et commande de migration de production (`pnpm --filter @notre-nid/api run db:migrate:deploy`).
- Configuration EAS (`apps/mobile/eas.json`) avec profils `development`/`preview`/`production`.
- `.env.example` complet et commenté (racine + `apps/mobile`), sans aucun secret réel.
- CI GitHub Actions (`.github/workflows/ci.yml`) : lint, typecheck, tests, build, validation Prisma, fraîcheur des artefacts générés.
- Documentation complète : `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DEPLOYMENT.md`, `docs/BACKUP_AND_RESTORE.md`, `docs/OPERATIONS.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`, `docs/MOBILE_RELEASE.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`.

## À faire manuellement, dans l'ordre

Chaque étape indique : l'objectif, les valeurs nécessaires, où les renseigner, la commande à exécuter, comment vérifier, et les erreurs fréquentes.

### 1. Choisir et configurer la base de données managée

- **Objectif** : disposer d'une base PostgreSQL 16 accessible depuis l'hébergeur de l'API.
- **Options** : Neon, Supabase ou l'addon PostgreSQL de Railway (voir `docs/DEPLOYMENT.md`).
- **Valeur produite** : `DATABASE_URL` (format `postgresql://user:password@host:5432/db?schema=public`, ajouter `?sslmode=verify-full` si exigé par le fournisseur).
- **Où la renseigner** : variable d'environnement `DATABASE_URL` de l'hébergeur de l'API (jamais dans un fichier commité).
- **Vérifier** : `psql "$DATABASE_URL" -c "SELECT 1;"` depuis une machine autorisée à s'y connecter.
- **Erreurs fréquentes** : oublier `?sslmode=verify-full` (connexion refusée par certains fournisseurs) ; IP non autorisée dans les règles réseau du fournisseur.

### 2. Créer le bucket de stockage des images

- **Objectif** : stockage persistant des couvertures d'items (`STORAGE_DRIVER=s3` — jamais `local` en production, voir `docs/DEPLOYMENT.md`).
- **Options** : Supabase Storage, AWS S3 ou Cloudflare R2.
- **Valeurs produites** : `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ENDPOINT` (vide pour AWS S3 réel, URL de l'endpoint **authentifié** pour Supabase Storage/R2 — ex. `https://<account-id>.r2.cloudflarestorage.com`), `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, et `STORAGE_PUBLIC_URL` (base d'URL réellement publique du bucket — domaine personnalisé ou URL `*.r2.dev` pour R2).
- **Où les renseigner** : variables d'environnement de l'hébergeur de l'API.
- **Configuration requise** : bucket en **lecture publique** (l'API génère des URLs publiques directes, voir `docs/DECISIONS.md`) — politique bucket de type « lecture publique des objets », écriture restreinte aux identifiants ci-dessus.
- **⚠️ Avec Cloudflare R2** : `STORAGE_PUBLIC_URL` est **obligatoire**. L'endpoint S3 authentifié (`*.r2.cloudflarestorage.com`, renseigné dans `STORAGE_ENDPOINT`) n'est **jamais** accessible publiquement — seul sert aux opérations d'upload/suppression. Activer l'accès public du bucket (sous-domaine `*.r2.dev` fourni par Cloudflare, ou un domaine personnalisé mappé au bucket) et renseigner cette URL dans `STORAGE_PUBLIC_URL`, distincte de `STORAGE_ENDPOINT`.
- **Vérifier** : uploader un fichier de test via la console du fournisseur, confirmer que son URL publique (celle renseignée dans `STORAGE_PUBLIC_URL`, pas `STORAGE_ENDPOINT`) répond `200` sans authentification.
- **Erreurs fréquentes** : bucket créé en privé (les couvertures d'items ne s'afficheront jamais dans l'app) ; région du bucket différente de `STORAGE_REGION` renseignée ; **sur R2, utiliser l'endpoint `*.r2.cloudflarestorage.com` comme `STORAGE_PUBLIC_URL`** (erreur courante — cet endpoint est authentifié, pas public, les images ne s'afficheraient jamais).

### 3. Générer les secrets JWT de production

- **Objectif** : secrets distincts de ceux de développement et de CI.
- **Commande** : `openssl rand -hex 32` (exécuter deux fois, une valeur pour chaque secret).
- **Valeurs produites** : `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
- **Où les renseigner** : variables d'environnement de l'hébergeur de l'API.
- **Vérifier** : après déploiement, `POST /api/v1/auth/login` avec un compte réel renvoie un token exploitable sur les routes protégées.
- **Erreurs fréquentes** : réutiliser les valeurs de `.env.example`/développement (compromission immédiate, ces valeurs sont publiques dans le dépôt).

### 4. Configurer un service SMTP réel

- **Objectif** : envoi réel des emails d'invitation (Mailpit ne fonctionne qu'en développement).
- **Options** : Resend, Postmark, ou le SMTP fourni par l'hébergeur.
- **Valeurs produites** : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.
- **Où les renseigner** : variables d'environnement de l'hébergeur de l'API.
- **Vérifier** : créer une invitation depuis l'app (`POST /households/:id/invitations`) et confirmer la réception réelle de l'email.
- **Erreurs fréquentes** : `SMTP_FROM` non vérifié auprès du fournisseur (email rejeté ou classé indésirable).

### 5. Créer le service d'hébergement de l'API

- **Objectif** : héberger l'image `infrastructure/docker/api/Dockerfile` (cible `runtime`) ou un buildpack Node équivalent.
- **Options** : Railway, Render ou Fly.io (voir `docs/DEPLOYMENT.md`).
- **Valeurs à renseigner** : toutes les variables listées dans `.env.example`, avec les valeurs produites aux étapes 1 à 4, plus `NODE_ENV=production`, `CORS_ORIGINS` (restreint), `API_PUBLIC_URL` (URL HTTPS attribuée par l'hébergeur).
- **Commande de build/démarrage** (si buildpack plutôt qu'image Docker) : `pnpm --filter @notre-nid/api run build` puis `pnpm --filter @notre-nid/api run start:prod`.
- **Vérifier** : `curl https://<url-attribuée>/api/v1/health` → `200`.
- **Erreurs fréquentes** : port non exposé correctement (`PORT` doit être lu depuis l'environnement, ce qui est déjà le cas dans `apps/api/src/main.ts`) ; healthcheck de la plateforme pointé sur `/` au lieu de `/api/v1/health/ready`.

### 6. Exécuter la première migration de production

- **Objectif** : créer le schéma en base, avant tout trafic réel.
- **Commande** : `DATABASE_URL="<valeur de l'étape 1>" pnpm --filter @notre-nid/api run db:migrate:deploy` (ou `docker run --rm -e DATABASE_URL=... notre-nid-api:migrate`, voir `docs/DEPLOYMENT.md`).
- **Vérifier** : `psql "$DATABASE_URL" -c "\dt"` liste les tables attendues (`User`, `Household`, `Item`, ...).
- **Erreurs fréquentes** : exécuter `prisma migrate dev` par erreur (mode interactif non adapté à la production) ; DATABASE_URL pointant encore vers la base locale.
- **⚠️ Ne jamais exécuter cette étape sans avoir lu `docs/BACKUP_AND_RESTORE.md`** si une base contient déjà des données (migrations ultérieures).

### 7. Vérifier l'API en production

- **Commandes** :
  ```bash
  curl https://<url-api>/api/v1/health
  curl https://<url-api>/api/v1/health/ready
  ```
- **Vérifier** : les deux répondent `200` ; `/health/ready` confirme une connexion base réelle.
- **Erreurs fréquentes** : `503 DATABASE_UNAVAILABLE` sur `/health/ready` → revérifier `DATABASE_URL` et les règles réseau du fournisseur de base de données.

### 8. Créer le compte Expo et configurer EAS

- **Objectif** : pouvoir produire des builds mobiles installables.
- **Procédure complète** : voir `docs/MOBILE_RELEASE.md` (étapes 1 à 4).
- **Vérifier** : `npx eas-cli whoami` renvoie le compte connecté ; `apps/mobile/app.json` contient un `extra.eas.projectId` réel après `eas init`.

### 9. Renseigner l'URL publique de l'API côté mobile

- **Objectif** : que les builds `preview`/`production` du mobile joignent la vraie API.
- **Où** : `apps/mobile/eas.json`, remplacer les valeurs `EXPO_PUBLIC_API_URL` placeholder par l'URL HTTPS obtenue à l'étape 5.
- **Vérifier** : voir `docs/MOBILE_RELEASE.md` étape 6.

### 10. Produire un build Android installable et tester

- **Commande** : `npx eas-cli build --profile preview --platform android` (voir `docs/MOBILE_RELEASE.md` étape 8).
- **Vérifier** : installer l'APK produit sur au moins **deux appareils physiques distincts** (le PRD exige un test sur plusieurs appareils) ; parcourir a minima : connexion, consultation de la collection, ajout d'un item, upload de couverture.
- **Erreurs fréquentes** : `EXPO_PUBLIC_API_URL` encore en placeholder (étape 9 non faite) → l'app ne peut joindre aucune API.

### 11. Produire un build iOS et tester

- **Objectif et vérifications** : identiques à l'étape 10, plateforme iOS.
- **Prérequis** : compte Apple Developer actif (voir `docs/MOBILE_RELEASE.md` étape 10-11).

### 12. Configurer les sauvegardes de production

- **Objectif** : activer les sauvegardes automatiques du fournisseur de base de données (recommandé) ou planifier `infrastructure/scripts/backup-postgres.sh` (voir `docs/BACKUP_AND_RESTORE.md`).
- **Vérifier** : effectuer une restauration de test (`docs/BACKUP_AND_RESTORE.md#restauration-sur-une-base-de-test`) au moins une fois avant de considérer la mise en production terminée.

### 13. Configurer les alertes de monitoring

- **Objectif** : être notifié d'une indisponibilité sans avoir à consulter les logs en continu.
- **Options** : le monitoring d'uptime intégré de l'hébergeur (Railway/Render/Fly proposent tous une vérification de santé configurable), ou un service externe gratuit (ex. UptimeRobot) pointé sur `GET /api/v1/health/ready`.
- **Optionnel** : `SENTRY_DSN` (créer un projet sur [sentry.io](https://sentry.io), plan gratuit suffisant pour ce volume) pour la remontée d'erreurs applicatives détaillées — non configuré dans le code de cette V1 au-delà de la variable d'environnement déjà prévue.
- **Vérifier** : couper temporairement l'API (redémarrage manuel) et confirmer la réception d'une alerte.

### 14. Accepter les coûts des services choisis

- **Objectif** : confirmation explicite avant tout engagement financier récurrent.
- **Postes de coût typiques pour ce projet** (ordres de grandeur, à vérifier au moment de la souscription) : hébergement API (gratuit à ~5-10 $/mois selon le fournisseur et l'usage), base de données managée (souvent gratuite au volume d'une collection personnelle), stockage d'images (quelques centimes/mois à ce volume), nom de domaine optionnel (~10-15 $/an), compte Apple Developer (99 $/an, uniquement si publication iOS), compte Google Play Console (25 $, paiement unique, uniquement si publication Android).
- Aucun de ces services n'a été souscrit par Claude Code.

### (Optionnel) Nom de domaine personnalisé

- **Objectif** : une URL d'API mémorable (`api.notre-nid.example` plutôt que l'URL générée par l'hébergeur).
- **Procédure** : achat chez un registrar, puis configuration d'un enregistrement DNS (CNAME ou A selon l'hébergeur) pointé vers le service créé à l'étape 5 — la procédure exacte dépend de l'hébergeur choisi, voir sa documentation.
- **Non bloquant** : l'URL générée automatiquement par l'hébergeur fonctionne parfaitement pour un usage à deux utilisateurs.

## Notes de vérification héritées des phases précédentes

- **Vérification visuelle du mobile sur simulateur/émulateur non réalisée** dans l'environnement d'implémentation (voir `docs/PHASE_STATUS.md`, limitation documentée depuis la Phase 3A) — les étapes 10 et 11 ci-dessus couvrent explicitement cette vérification en conditions réelles.
- **Build Docker non vérifié dans l'environnement d'implémentation** : `docker build -f infrastructure/docker/api/Dockerfile .` n'a pas pu être exécuté (moteur Docker Desktop indisponible — erreur `500 Internal Server Error` au moment de la Phase 5, voir `docs/PHASE_STATUS.md`). En compensation, chaque commande du Dockerfile a été rejouée manuellement hors Docker (`pnpm install`, `prisma generate`, `nest build`, `pnpm deploy --prod --legacy`, régénération du client Prisma, `node dist/main.js`, `curl /health` et `/health/ready`) — un bug réel a été trouvé et corrigé de cette façon (client Prisma absent du répertoire déployé par `pnpm deploy`, qui réinstalle un `node_modules` isolé). Le build Docker lui-même (assemblage en image, healthcheck Docker) **reste à exécuter avant tout déploiement réel** :
  ```bash
  docker build -f infrastructure/docker/api/Dockerfile -t notre-nid-api:latest .
  docker run --rm -p 3000:3000 --env-file .env notre-nid-api:latest
  curl http://localhost:3000/api/v1/health
  ```
