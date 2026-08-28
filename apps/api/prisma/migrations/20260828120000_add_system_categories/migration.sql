-- Catégories système requises par l'application (Livres/CD/DVD, docs/NOTRE_NID_PRD.md
-- section 5) — jusqu'ici créées uniquement par le script de démonstration
-- (prisma/seed.ts), volontairement jamais exécuté en production (aucune donnée de
-- démonstration). Résultat : une base migrée mais jamais seedée (ex. production) n'a
-- aucune catégorie système, et tout sélecteur de catégorie de l'application y est vide.
--
-- Cette migration garantit leur existence sur TOUTE base, y compris une base de
-- production qui ne recevra jamais le seed. Idempotente : chaque INSERT est gardé par un
-- NOT EXISTS explicite sur ("householdId" IS NULL, slug) plutôt qu'un ON CONFLICT, car la
-- contrainte unique @@unique([householdId, slug]) porte sur une colonne nullable —
-- Postgres ne considère jamais deux valeurs NULL comme en conflit sous un index unique
-- standard, donc ON CONFLICT ne détecterait aucun doublon pour ces lignes système
-- (householdId = NULL). Voir le même commentaire dans prisma/seed.ts, qui contourne la
-- même limitation avec findFirst + create conditionnel plutôt qu'un upsert().

INSERT INTO "categories" ("id", "householdId", "name", "slug", "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, NULL, 'Livres', 'book', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" WHERE "householdId" IS NULL AND "slug" = 'book'
);

INSERT INTO "categories" ("id", "householdId", "name", "slug", "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, NULL, 'CD', 'cd', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" WHERE "householdId" IS NULL AND "slug" = 'cd'
);

INSERT INTO "categories" ("id", "householdId", "name", "slug", "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, NULL, 'DVD', 'dvd', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" WHERE "householdId" IS NULL AND "slug" = 'dvd'
);
