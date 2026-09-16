-- Bloc 1 — Nettoyage du modèle Item et préparation au futur scan (docs/DECISIONS.md).

-- 1. Code-barres générique, préparatoire au scan (EAN-8/13, UPC-A/E, futurs formats).
-- Facultatif, non unique (un foyer peut posséder plusieurs exemplaires du même produit).
-- AlterTable
ALTER TABLE "items" ADD COLUMN     "barcode" TEXT;

-- 2. Suppression de "cd_metadata.album", redondant avec "items.title" pour un CD.
-- Vérifié sur les données réelles avant suppression (5 items CD) : un seul avait "album"
-- renseigné, et sa valeur était strictement identique à "title" ("ERA" / "ERA") — aucune
-- perte d'information, aucune divergence album/title constatée.
-- AlterTable
ALTER TABLE "cd_metadata" DROP COLUMN "album";
