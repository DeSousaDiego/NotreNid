-- AlterTable
ALTER TABLE "items" ADD COLUMN     "rating" DOUBLE PRECISION;

-- Seconde ligne de défense derrière la validation applicative (class-validator @IsIn
-- sur les 10 valeurs 0.5..5 par pas de 0.5, voir CreateItemDto) : la plage et le pas
-- sont aussi contraints au niveau base contre toute écriture hors validation.
ALTER TABLE "items" ADD CONSTRAINT "items_rating_valid_check"
  CHECK ("rating" IS NULL OR ("rating" >= 0.5 AND "rating" <= 5 AND ROUND("rating" * 2) = "rating" * 2));
