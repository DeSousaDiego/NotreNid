-- Format physique de l'édition livre (ex. "Hardcover", "Paperback", "Mass Market
-- Paperback") — texte libre, non normalisé, même convention que
-- cd_metadata.format/dvd_metadata.format (voir docs/DECISIONS.md). Facultative,
-- additive, aucune perte de données existantes.
-- AlterTable
ALTER TABLE "book_metadata" ADD COLUMN     "format" TEXT;
