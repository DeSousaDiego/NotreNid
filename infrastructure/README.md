# infrastructure/

Artefacts d'infrastructure de production, introduits en Phase 5 — Livraison :

- `docker/api/Dockerfile` — image de production multi-stage de l'API (cibles `runtime` et `migrate`). Voir `docs/DEPLOYMENT.md`.
- `scripts/backup-postgres.sh` — sauvegarde `pg_dump` paramétrée par variables d'environnement, sans secret en dur. Voir `docs/BACKUP_AND_RESTORE.md`.

Le développement local utilise le `docker-compose.yml` à la racine du dépôt, pas ce dossier.
