# Sauvegardes et restauration — Notre Nid

## Sauvegarde automatique de PostgreSQL

Si la base est hébergée chez un fournisseur managé (recommandé, voir `docs/DEPLOYMENT.md`) : **activer les sauvegardes automatiques du fournisseur** (Neon, Supabase et Railway proposent toutes des sauvegardes quotidiennes gérées, généralement incluses dès le plan gratuit/hobby avec rétention limitée, étendue sur les plans payants). C'est la méthode recommandée : aucune infrastructure à maintenir, restauration en quelques clics depuis le tableau de bord du fournisseur.

**Rétention recommandée** : au minimum 7 jours de sauvegardes quotidiennes ; 30 jours si le plan choisi le permet sans surcoût significatif. Un projet personnel comme celui-ci n'a pas besoin d'une rétention de plusieurs mois.

## Export manuel

En complément des sauvegardes automatiques du fournisseur (ou en l'absence d'une base managée, stratégie VPS), un script est fourni :

```bash
DATABASE_URL="postgresql://user:password@host:5432/notre_nid" \
  ./infrastructure/scripts/backup-postgres.sh
```

- Ne contient **aucun secret en dur** : `DATABASE_URL` doit être exporté dans l'environnement avant l'exécution.
- Produit une archive au format personnalisé `pg_dump` (`-Fc`, compressée, restaurable sélectivement) dans `./backups/notre-nid-<horodatage-UTC>.dump` (répertoire ignoré par Git).
- Nécessite les client tools PostgreSQL 16 (`pg_dump`) installés localement, ou une exécution depuis une machine/CI qui les fournit déjà.
- À exécuter manuellement avant toute opération risquée (voir « Avant une migration risquée » ci-dessous), ou à planifier (cron, tâche planifiée CI) si aucune sauvegarde automatique de fournisseur n'est disponible.

Export applicatif complémentaire (ne remplace pas une sauvegarde base de données complète, mais utile pour un export utilisateur ponctuel) : `GET /households/:id/exports/json` et `/exports/csv` — voir `docs/API.md`.

## Restauration sur une base de test

**Ne jamais restaurer directement sur la base de production** pour vérifier une sauvegarde. Procédure recommandée :

```bash
# 1. Créer une base de test vide (locale ou instance managée temporaire dédiée aux tests).
createdb notre_nid_restore_test

# 2. Restaurer l'archive dans cette base de test.
pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname="postgresql://user:password@localhost:5432/notre_nid_restore_test" \
  ./backups/notre-nid-<horodatage>.dump

# 3. Vérifier le contenu restauré.
psql "postgresql://user:password@localhost:5432/notre_nid_restore_test" \
  -c "SELECT count(*) FROM \"User\";" \
  -c "SELECT count(*) FROM \"Item\";"

# 4. Supprimer la base de test une fois la vérification terminée.
dropdb notre_nid_restore_test
```

## Test régulier des sauvegardes

Une sauvegarde jamais restaurée n'est pas une garantie. Recommandation : effectuer la procédure de restauration sur base de test ci-dessus **au moins une fois par trimestre**, et systématiquement avant toute migration jugée risquée. Documenter la date du dernier test réussi dans `docs/PHASE_STATUS.md` ou un journal d'exploitation équivalent.

## Sauvegarde des images

- Si `STORAGE_DRIVER=s3` (recommandé en production) : activer la réplication/versioning du bucket côté fournisseur (S3 : versioning de bucket ; Supabase Storage : voir sa documentation de sauvegarde). Les images ne sont **pas** incluses dans `pg_dump` — seule leur URL est stockée en base.
- Si `STORAGE_DRIVER=local` (développement uniquement) : le volume `apps/api/storage/uploads/` n'est pas sauvegardé automatiquement ; à exclure de toute stratégie de production (voir `docs/DEPLOYMENT.md`).

## Risques liés à la suppression d'un bucket

- Une image supprimée du bucket sans que l'`Item` correspondant soit mis à jour laisse une URL de couverture morte (dégradation visuelle, pas une fuite de données) — vérifier avant toute suppression manuelle de bucket qu'aucun `Item.coverImageUrl` n'y fait encore référence.
- La suppression d'un bucket entier est **irréversible** côté fournisseur de stockage sauf versioning/corbeille activé. Ne jamais supprimer un bucket de production sans confirmation explicite du propriétaire du dépôt et sans sauvegarde préalable de son contenu.

## Procédure avant une migration risquée

Avant toute migration Prisma modifiant ou supprimant une colonne/table existante en production :

1. Exécuter `./infrastructure/scripts/backup-postgres.sh` (ou déclencher une sauvegarde manuelle du fournisseur managé).
2. Vérifier que la sauvegarde est restaurable (procédure « Restauration sur une base de test » ci-dessus), sauf si le fournisseur garantit déjà ce point.
3. Appliquer la migration via `pnpm --filter @notre-nid/api run db:migrate:deploy` (jamais `migrate dev` en production — voir `docs/DEPLOYMENT.md`).
4. Vérifier `GET /health/ready` et un parcours applicatif minimal (connexion, lecture de la collection) immédiatement après.
5. Conserver la sauvegarde pré-migration au moins jusqu'à la validation complète de la nouvelle version en production.
