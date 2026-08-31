-- CreateTable
CREATE TABLE "item_countries" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_countries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_countries_itemId_countryCode_key" ON "item_countries"("itemId", "countryCode");

-- CreateIndex
-- Future carte du monde (comptage d'items par pays, filtrable par catégorie via la relation
-- `item`) : accélère les regroupements/filtres par `countryCode` sans remettre en cause
-- l'unicité (itemId, countryCode) ci-dessus, portée par un index distinct.
CREATE INDEX "item_countries_countryCode_idx" ON "item_countries"("countryCode");

-- Seconde ligne de défense derrière la validation applicative (class-validator @IsIn sur la
-- liste ISO 3166-1 alpha-2 complète, voir apps/api/src/items/dto/create-item.dto.ts) : ne
-- contraint que le FORMAT (2 lettres majuscules) — la liste ISO complète (249 valeurs) n'est
-- volontairement pas dupliquée dans un CHECK, contrairement à `items_rating_valid_check` qui ne
-- porte que sur 10 valeurs numériques. Même logique de défense en profondeur que le rating.
ALTER TABLE "item_countries" ADD CONSTRAINT "item_countries_country_code_format_check"
  CHECK ("countryCode" ~ '^[A-Z]{2}$');

-- AddForeignKey
ALTER TABLE "item_countries" ADD CONSTRAINT "item_countries_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
