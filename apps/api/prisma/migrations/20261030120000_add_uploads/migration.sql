-- Release 0A — isolation des uploads (docs/PHASE_STATUS.md).
--
-- Avant : `DELETE /households/:householdId/uploads/:uploadId` vérifiait seulement que
-- l'appelant était membre de :householdId, puis supprimait l'objet de stockage nommé
-- :uploadId — sans aucun lien entre ce fichier et ce foyer. Chaque fichier téléversé est
-- désormais enregistré ici avec son foyer, et seule cette ligne autorise une suppression.
--
-- Migration purement additive : aucune donnée existante modifiée ni supprimée.
--
-- Pas de backfill, volontairement : les couvertures téléversées avant cette migration ne
-- sont référencées que par une URL libre (`items.coverImageUrl`, que l'API ne valide pas),
-- et l'auteur réel du fichier n'a jamais été enregistré. Rattacher un fichier à un foyer
-- depuis ces URL reviendrait à deviner — et pourrait offrir à un foyer le droit de supprimer
-- le fichier d'un autre (une URL pointant vers la couverture ou l'avatar d'autrui suffirait).
-- Ces anciennes couvertures restent affichées normalement ; elles ne sont simplement plus
-- supprimables via l'API (le mobile ne supprime de toute façon que le fichier qu'il vient de
-- téléverser dans la même session de formulaire).
--
-- Ordre de déploiement : appliquer cette migration AVANT de déployer le nouveau backend
-- (il écrit dans "uploads" à chaque téléversement). L'ancien backend l'ignore sans erreur.

-- CreateEnum
CREATE TYPE "UploadKind" AS ENUM ('ITEM_COVER');

-- CreateTable
CREATE TABLE "uploads" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "kind" "UploadKind" NOT NULL DEFAULT 'ITEM_COVER',
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uploads_storageKey_key" ON "uploads"("storageKey");

-- CreateIndex
CREATE INDEX "uploads_householdId_idx" ON "uploads"("householdId");

-- CreateIndex
CREATE INDEX "uploads_uploadedById_idx" ON "uploads"("uploadedById");

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
