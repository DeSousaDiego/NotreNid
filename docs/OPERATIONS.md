# Opérations — Notre Nid

Guide des opérations courantes une fois l'API en production. Complète `docs/DEPLOYMENT.md` (comment déployer) et `docs/BACKUP_AND_RESTORE.md` (sauvegardes).

## Vérifier la santé

```bash
curl https://<url-api>/api/v1/health          # liveness — répond dès que le process tourne
curl https://<url-api>/api/v1/health/ready    # readiness — exécute un SELECT 1 réel contre PostgreSQL
```

`/health/ready` renvoie `503 DATABASE_UNAVAILABLE` (format d'erreur standard) si la base est injoignable — voir `apps/api/src/health/health.controller.ts`. Configurer le healthcheck de la plateforme d'hébergement sur `/health/ready`, pas `/health`, pour qu'un redémarrage automatique se déclenche en cas de perte de connexion base durable.

## Consulter les logs

- **Développement** : logs lisibles en console (`AppLogger`, `apps/api/src/common/logger/app-logger.service.ts`).
- **Production** : une ligne JSON structurée par entrée (même logger, basculé automatiquement via `NODE_ENV=production`). Chaque requête HTTP est journalisée avec méthode, chemin, statut, durée et `requestId` (`RequestLoggingInterceptor`).
- Corréler une erreur signalée par un utilisateur avec les logs serveur via le champ `requestId` de la réponse d'erreur (`docs/API.md`) — rechercher cette valeur dans les logs de la plateforme d'hébergement (Railway/Render/Fly exposent tous une recherche plein texte sur les logs).
- Aucune donnée sensible (mot de passe, token, secret) n'apparaît dans les logs — vérifié en Phase 4.

## Redémarrer l'API

- Hébergeur managé : redémarrage via son tableau de bord ou son CLI (`railway restart`, etc. — action manuelle du propriétaire, dépend du service choisi, voir `docs/GO_LIVE_CHECKLIST.md`).
- VPS/Docker Compose : `docker compose restart api` (le conteneur gère l'arrêt propre des signaux `SIGTERM`, Node.js Nest s'arrête proprement par défaut).

## Déployer une migration

Voir la procédure complète dans `docs/DEPLOYMENT.md#migrations-de-production`. Résumé :

```bash
pnpm --filter @notre-nid/api run db:migrate:deploy
```

Toujours précédé d'une sauvegarde (`docs/BACKUP_AND_RESTORE.md`) pour toute migration touchant des données existantes.

## Revenir en arrière

- **Code applicatif** : redéployer la version d'image/commit précédente via la plateforme d'hébergement (chaque déploiement managé conserve un historique de versions).
- **Migration de schéma** : Prisma ne fournit pas de rollback automatique. Si une migration doit être annulée : écrire une **nouvelle migration inverse** (jamais modifier ou supprimer la migration déjà appliquée, voir `CLAUDE.md`), ou restaurer la sauvegarde pré-migration si la migration a corrompu des données (voir `docs/BACKUP_AND_RESTORE.md`).

## Changer un secret

1. Générer la nouvelle valeur (`openssl rand -hex 32` pour un secret JWT).
2. La renseigner dans la configuration de la plateforme d'hébergement (jamais dans un fichier commité).
3. Redéployer/redémarrer l'API pour qu'elle prenne effet.
4. **Effet de bord attendu pour `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`** : tous les tokens émis avec l'ancien secret deviennent invalides — tous les utilisateurs sont déconnectés et doivent se reconnecter. Communiquer ce point avant une rotation planifiée (voir aussi « Révoquer des sessions » ci-dessous, qui a le même effet mais de façon ciblée).

## Restaurer une base de données

Voir la procédure complète dans `docs/BACKUP_AND_RESTORE.md#restauration-sur-une-base-de-test`. Ne restaurer directement sur la base de production qu'en dernier recours (perte de données confirmée), jamais sans confirmation explicite du propriétaire du dépôt.

## Gérer un incident

1. Vérifier `/health/ready` en premier — distingue un problème applicatif d'un problème de base de données.
2. Consulter les logs récents filtrés sur les statuts `5xx` et le `requestId` concerné le cas échéant.
3. Vérifier le statut du fournisseur de base de données et de stockage (pages de statut publiques des fournisseurs managés).
4. Si l'incident est lié à un déploiement récent : revenir en arrière (voir ci-dessus) avant d'investiguer plus avant en production.
5. Documenter l'incident (cause, résolution, action préventive) — pas d'outil dédié fourni par ce dépôt ; un simple journal (fichier, issue GitHub) suffit à l'échelle de ce projet.

## Vérifier le stockage

```bash
# STORAGE_DRIVER=local (développement) : le fichier existe-t-il sur disque ?
ls apps/api/storage/uploads/

# STORAGE_DRIVER=s3 (production) : l'objet est-il accessible publiquement ?
curl -I "<url-retournée-par-l'API-lors-de-l'upload>"   # doit répondre 200
```

En cas d'échec d'upload en production avec `STORAGE_DRIVER=s3`, vérifier dans l'ordre : les identifiants (`STORAGE_ACCESS_KEY`/`STORAGE_SECRET_KEY`), l'existence et la politique de lecture publique du bucket (`STORAGE_BUCKET`), puis l'endpoint (`STORAGE_ENDPOINT` — doit rester vide pour AWS S3 réel, renseigné pour Supabase Storage/MinIO/R2).

Si les couvertures s'uploadent avec succès mais **ne s'affichent jamais** dans l'app (image cassée), le problème est presque toujours `STORAGE_PUBLIC_URL` : cette variable (distincte de `STORAGE_ENDPOINT`) doit contenir la base d'URL réellement publique du bucket. Sur Cloudflare R2 en particulier, `STORAGE_ENDPOINT` (`*.r2.cloudflarestorage.com`) n'est **jamais** accessible publiquement — l'oubli de `STORAGE_PUBLIC_URL` (ou son renseignement avec la même valeur que `STORAGE_ENDPOINT`) produit exactement ce symptôme. Vérifier avec `curl -I` directement sur l'URL retournée par l'API lors de l'upload (voir ci-dessus) : `403`/timeout indique un problème de `STORAGE_PUBLIC_URL` ou de politique de lecture publique du bucket.

## Révoquer des sessions

- **Un seul appareil** : l'utilisateur se déconnecte normalement (`POST /auth/logout`) — révoque le refresh token courant.
- **Tous les appareils d'un utilisateur** : `POST /auth/logout-all` (déclenchable par l'utilisateur lui-même depuis Profil → Déconnexion globale) — révoque toutes les `RefreshSession` actives de ce compte. Utile en cas de suspicion de compromission d'un compte.
- **Toutes les sessions, tous les utilisateurs** (rotation d'urgence des secrets JWT) : voir « Changer un secret » ci-dessus.

## Documents liés

- [docs/DEPLOYMENT.md](DEPLOYMENT.md) — stratégies et procédure de déploiement.
- [docs/BACKUP_AND_RESTORE.md](BACKUP_AND_RESTORE.md) — sauvegardes et restauration détaillées.
- [docs/ARCHITECTURE.md](ARCHITECTURE.md) — vue d'ensemble technique.
