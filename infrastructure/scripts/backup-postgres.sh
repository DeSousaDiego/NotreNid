#!/usr/bin/env bash
# Sauvegarde PostgreSQL locale ou distante via pg_dump — voir docs/BACKUP_AND_RESTORE.md.
#
# N'embarque et ne lit jamais de secret en dur : DATABASE_URL doit être exporté dans
# l'environnement avant l'exécution (jamais commité). Exemple :
#
#   DATABASE_URL="postgresql://user:password@host:5432/notre_nid" \
#     ./infrastructure/scripts/backup-postgres.sh
#
# Produit une archive compressée horodatée dans BACKUP_DIR (par défaut ./backups, ignoré
# par Git) au format personnalisé pg_dump (-Fc), restaurable avec pg_restore
# (voir docs/BACKUP_AND_RESTORE.md pour la procédure complète de restauration).

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Erreur : la variable d'environnement DATABASE_URL doit être définie." >&2
  echo "Exemple : DATABASE_URL=\"postgresql://user:password@host:5432/db\" $0" >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Erreur : pg_dump introuvable. Installer les client tools PostgreSQL 16, ou exécuter" >&2
  echo "ce script depuis un conteneur/une machine qui les fournit déjà." >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_DIR}/notre-nid-${TIMESTAMP}.dump"

echo "Sauvegarde en cours vers ${BACKUP_FILE}..."
pg_dump --format=custom --no-owner --no-privileges --file="$BACKUP_FILE" "$DATABASE_URL"

echo "Sauvegarde terminée : ${BACKUP_FILE} ($(du -h "$BACKUP_FILE" | cut -f1))"
echo "Restauration : voir docs/BACKUP_AND_RESTORE.md (pg_restore --clean --if-exists ...)"
