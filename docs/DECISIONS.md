# Décisions techniques — Notre Nid

Journal des décisions structurantes et de leur justification. Complète `docs/PHASE_STATUS.md` (qui documente aussi des décisions locales à chaque phase) en réunissant les choix transverses, imposés ou confirmés par `docs/NOTRE_NID_PRD.md`.

## Pourquoi PostgreSQL

Requis explicitement par le PRD (section 3). Un modèle relationnel convient naturellement à des relations plusieurs-à-plusieurs explicites (`ItemOwner`, `HouseholdMember`) et à des contraintes d'intégrité fortes (unicité `householdId + userId`, clés étrangères) — plus adapté qu'une base documentaire à un modèle de permissions strict par household. PostgreSQL 16 est mature, dispose d'une recherche texte native (voir « pourquoi pas d'Elasticsearch ») et de fournisseurs managés matures (Neon, Supabase, Railway).

## Pourquoi NestJS

Requis par le PRD. Apporte une structure modulaire imposée (un module par domaine métier), l'injection de dépendances (facilite les tests unitaires par mock plutôt que par framework de test lourd — voir tous les `*.service.spec.ts`), une intégration Swagger/OpenAPI de premier ordre, et des guards/interceptors/pipes qui séparent proprement l'autorisation (`HouseholdMembershipGuard`), la validation (`ValidationPipe` global) et la logique métier — cohérent avec la règle « jamais de logique métier dans les contrôleurs » (`CLAUDE.md`).

## Pourquoi Expo

Requis par le PRD. Permet de cibler Android et iOS depuis une base de code unique avec un flux de build géré (EAS) sans nécessiter de machine macOS pour les builds iOS — déterminant pour un développement solo. Expo Router apporte un routage basé fichiers cohérent avec le reste de l'écosystème React et évite d'écrire une configuration de navigation manuelle complexe.

## Pourquoi REST (pas GraphQL)

Le domaine est constitué de ressources CRUD classiques (households, items, catégories) sans besoin réel d'agrégation flexible côté client ni de sous-abonnements temps réel. REST + OpenAPI donne un contrat simple, documentable, et un client typé généré/vérifié sans la complexité d'un serveur GraphQL (résolveurs, N+1, schéma fédéré) disproportionnée pour ce périmètre.

## Pourquoi la relation `ItemOwner` (jamais un simple `ownerId`)

Le PRD est explicite (section 1) : la propriété réelle d'un objet est distincte de sa visibilité (household). Un livre peut appartenir à un seul membre, un DVD aux deux. Un champ `ownerId` unique sur `Item` rendrait cette règle impossible à représenter sans hack (ex. un `ownerId` nullable + une liste séparée). La table de jointure `ItemOwner` (plusieurs-à-plusieurs explicite) modélise directement l'invariant métier réel et permet de le valider simplement (chaque propriétaire doit être membre du household de l'item).

## Pourquoi la suppression logique (archivage)

Un item archivé reste consultable et restaurable (`archivedAt` nullable sur `Item`) plutôt que supprimé physiquement. Cohérent avec le positionnement affectif du produit (section 4 du PRD : « Notre Nid » comme carnet partagé, pas outil de gestion) — une suppression accidentelle d'un souvenir ne doit jamais être irréversible sans action explicite. Techniquement plus simple qu'une corbeille séparée ou un système d'événements, proportionné au besoin réel.

## Pourquoi pas de microservices

Un seul domaine métier cohérent (gestion de collection partagée), une seule base de données, une équipe d'un développeur. Des microservices ajouteraient une complexité opérationnelle (déploiements coordonnés, communication réseau inter-services, cohérence distribuée) sans bénéfice réel à cette échelle — contraire à la mise en garde du PRD contre la sur-ingénierie.

## Pourquoi pas d'Elasticsearch

Le PRD le déconseille explicitement (section 8) pour ce périmètre. La recherche actuelle (`ILIKE` insensible à la casse sur titre/auteur/artiste/album/réalisateur/ISBN/notes) suffit au volume de données d'une collection personnelle de couple (des centaines à quelques milliers d'items, pas des millions). L'architecture n'empêche pas une migration future vers la recherche full-text native de PostgreSQL (`tsvector`/`tsquery`) si le besoin se confirme — voir `docs/ROADMAP.md` — sans dépendance externe supplémentaire.

## Stratégie de métadonnées par catégorie

Champs communs sur `Item` (titre, description, état, notes) + tables spécialisées en relation un-à-un pour les trois catégories système (`BookMetadata`, `CdMetadata`, `DvdMetadata`), validées strictement par DTO. Les catégories personnalisées utilisent un JSON (`Category.metadataSchema` définit la forme attendue, validée à l'exécution) plutôt que des tables dynamiques — évite une architecture excessivement dynamique qui rendrait la validation des trois catégories principales impossible à typer correctement (mise en garde explicite du PRD section 5), tout en gardant l'extensibilité requise pour de futures catégories.

## Stockage : URL publique directe plutôt qu'URL signée

`S3StorageDriver` (`apps/api/src/uploads/storage/s3-storage.driver.ts`, Phase 5) construit une URL publique directe vers l'objet plutôt que de générer une URL signée à durée limitée. Les couvertures d'items ne sont pas des données sensibles (contrairement aux données du household elles-mêmes, protégées par l'authentification et l'isolation stricte) — une URL publique simplifie l'implémentation (pas de renouvellement d'URL expirée côté mobile) sans compromis de sécurité réel pour ce cas d'usage. Nécessite que le bucket soit configuré en lecture publique (voir `docs/DEPLOYMENT.md`) ; documenté comme prérequis manuel plutôt qu'automatisé (dépend du fournisseur choisi).

## Pas de client API généré depuis OpenAPI (Phase 4)

`packages/api-client` reste manuscrit ; une vérification compilée (`packages/api-client/src/contract.ts`, types générés via `openapi-typescript`) détecte toute dérive avec le contrat réel sans réécrire un client déjà validé et testé depuis la Phase 3A — voir `docs/PHASE_STATUS.md` (Phase 4) pour le détail.

## Upload d'image mobile : `expo-file-system` `File`, jamais `{ uri, name, type }`

Le SDK Expo installé (57) remplace le `fetch` global par sa propre implémentation « Winter » (`expo/src/winter/fetch`), qui ne sait plus sérialiser la pseudo-partie `FormData` historique de React Native (`{ uri, name, type }`) — elle lève `Unsupported FormDataPart implementation` (confirmé en lisant le code source installé, pas la documentation : `expo/src/winter/fetch/convertFormData.ts` n'accepte qu'une chaîne, un vrai `Blob`, ou tout objet exposant `.bytes()`). `useUploads.ts` construit donc systématiquement un `expo-file-system` `File` (qui expose `.bytes()` et dérive nom/type MIME de l'URI elle-même, sans dépendre de `fileName`/`mimeType` — souvent absents côté Android) avant de l'ajouter au `FormData`. Ne jamais revenir à la pseudo-partie `{ uri, name, type }` pour un upload de fichier local sur mobile.

## Invitation par code (Bloc 2) : `@map` plutôt qu'un renommage de colonne

`HouseholdInvitation.codeHash` (`apps/api/prisma/schema.prisma`) porte `@map("tokenHash")` : le champ Prisma/TypeScript est renommé (`tokenHash` → `codeHash`, cohérent avec le nouveau vocabulaire « code d'invitation »), mais la colonne physique en base reste `tokenHash`, jamais renommée. La migration associée (`20260831180000_add_invitation_codes`) ne contient donc aucun `RENAME COLUMN`/`RENAME INDEX` pour cette partie — seulement deux ajouts strictement additifs (`email` devient nullable, `revokedAt` est ajoutée).

**Portée exacte de cette compatibilité** : elle ne concerne que le renommage `tokenHash`/`codeHash` lui-même, pas la migration dans son ensemble. Le nouveau backend dépend réellement de `email` nullable (il peut créer une invitation avec `email: null`) et de l'existence de `revokedAt` (lue et écrite par `InvitationsService`) : **la migration doit donc être appliquée avant le déploiement du nouveau backend**, pas après ni en parallèle. Dans l'autre sens, l'ancien backend reste indifférent à la migration une fois appliquée (il fournit toujours un email non nul et ignore une colonne `revokedAt` qu'il ne référence pas) — c'est cette moitié de la fenêtre de déploiement, et uniquement elle, que le `@map` rend sans risque. Ordre à respecter : migration → déploiement API → OTA mobile (voir `docs/DEPLOYMENT.md#migrations-de-production` et `docs/OPERATIONS.md#déployer-une-migration`).

**Hachage du code** : `codeHash` est un HMAC-SHA256 dont la clé (« pepper ») est dérivée de `JWT_ACCESS_SECRET` (jamais stockée en base), pas un simple `SHA-256(code)` — un code de 8 caractères (~39,6 bits d'entropie) serait cassable hors ligne en quelques minutes à partir d'un hash simple si la base venait à fuiter ; le pepper serveur rend cette attaque hors ligne impraticable sans accès aux variables d'environnement. **Effet de bord à connaître** : toute rotation de `JWT_ACCESS_SECRET` change le pepper et invalide silencieusement tous les codes d'invitation actifs (les lignes `codeHash` existantes ne correspondront plus jamais) — documenté dans `docs/OPERATIONS.md#changer-un-secret`. Les invitations concernées expirent de toute façon naturellement sous 7 jours ; il suffit d'en régénérer une nouvelle après une rotation si besoin immédiat.

Les valeurs `tokenHash` déjà présentes avant le Bloc 2 (ancien algorithme SHA-256 simple sur un jeton de 64 caractères) deviennent orphelines dès le déploiement du nouveau backend, quel que soit le moment de la migration : aucune conversion n'est possible (le jeton en clair n'a jamais été persisté). Elles expirent naturellement sous 7 jours (`INVITATION_TTL_MS`) — pas de suppression explicite nécessaire.

## Suppression de `CdMetadata.album` (Bloc 1, refonte ajout)

Un audit du modèle avant refonte a établi que, pour un CD, `Item.title` porte déjà le titre de l'album/release dans la quasi-totalité des cas — `CdMetadata.album` était systématiquement redondant : jamais lu par la carte de collection ou le sous-titre (`secondaryInfoForItem` n'utilise que `artist`), et dupliqué à l'identique sur la fiche détail lorsqu'il était renseigné.

**Vérification sur les données réelles avant suppression** (lecture seule, base configurée dans `.env`) : sur 5 items CD existants, un seul avait `album` renseigné (`"ERA"`), avec une valeur strictement identique à `title` (`"ERA"`) ; les 4 autres avaient `album` à `null`. Aucune divergence album/title constatée — la suppression ne fait donc perdre aucune information : toute valeur `album` existante était soit absente, soit déjà présente dans `title`.

Décision : `Item.title` devient l'unique titre d'un CD (celui de l'album/release) ; `CdMetadata.album` est supprimé par migration (`20260916120000_cleanup_cd_album_add_item_barcode`) plutôt que conservé pour compatibilité — le conserver aurait maintenu l'ambiguïté que le futur scan code-barres devra justement éviter (un fournisseur externe renvoie un nom d'album, jamais un « titre » distinct ; sans arbitrage préalable, l'intégration du scan aurait dû choisir entre deux champs redondants).

## `Item.barcode` : préparation générique au scan code-barres (Bloc 1)

`Item.barcode` (`String?`, non unique) est ajouté au niveau générique de l'item — pas dans les tables `BookMetadata`/`CdMetadata`/`DvdMetadata` — pour rester applicable aux trois catégories système sans duplication de champ, et rester non contraint en format (assez générique pour EAN-8, EAN-13, UPC-A, UPC-E et de futurs formats non encore identifiés). Volontairement non unique : un foyer peut posséder plusieurs exemplaires physiques du même produit (ex. deux copies du même livre).

Aucune contrainte `CHECK` de format n'est ajoutée en base (contrairement à `Item.rating` ou `ItemCountry.countryCode`) : le format exact des codes qui seront scannés n'est pas encore figé, et une contrainte trop stricte aujourd'hui risquerait de bloquer un format légitime découvert au moment de l'implémentation du scan (Bloc futur).

`BookMetadata.isbn` reste inchangé et n'est pas synchronisé automatiquement avec `barcode` : pour un livre, le code-barres scanné (EAN-13) *est* généralement l'ISBN-13, mais la règle de correspondance exacte (copier isbn → barcode ? valider l'un par rapport à l'autre ?) sera tranchée au moment de l'implémentation du scan, pas avant.

Le champ n'est volontairement pas exposé dans le formulaire manuel mobile (`apps/mobile/src/screens/item-form/`) : ni dans `ItemFormValues`/`itemFormSchema`, ni dans une étape visible. Il n'existe pour l'instant que dans le modèle Prisma, les DTO API (`CreateItemDto`/`UpdateItemDto`), les types partagés (`@notre-nid/shared`) et le client typé (`@notre-nid/api-client`) — prêt à être renseigné par la future fonctionnalité de scan sans nécessiter de nouvelle migration.

## Résolution de code-barres (Bloc 3A) : architecture, providers, cache

**Endpoint dédié, hors du household** — `POST /api/v1/items/barcode/resolve` vit dans son propre contrôleur (`apps/api/src/items/barcode/barcode.controller.ts`, `@Controller('items/barcode')`), pas sous `households/:householdId/items`. Cette route ne lit ni n'écrit aucune donnée de household (recherche externe en lecture seule) : `HouseholdMembershipGuard` n'aurait rien à vérifier et son `:householdId` obligatoire n'a pas de sens ici. Seul `JwtAuthGuard` s'applique (authentification, pas d'appartenance à vérifier).

**Correspondance `Item.barcode` / `BookMetadata.isbn` (tranche la question laissée ouverte par la décision précédente)** : pour `book`, les deux portent la même valeur normalisée (l'EAN-13 scanné *est* l'ISBN-13 dès qu'il commence par 978/979 — pas de conversion vers ISBN-10). Le mobile préremplit donc `values.barcode` et `values.metadata.isbn` avec la même chaîne à la réception d'un résultat "matched".

**Provider principal + repli, jamais une réponse brute exposée** — `BookBarcodeResolverService` interroge Google Books en premier (couverture large, gratuit sans clé bien que limité), puis Open Library uniquement si Google Books ne renvoie aucun résultat exploitable (`null`) *ou* échoue techniquement (timeout/erreur réseau/HTTP). Chaque provider (`GoogleBooksProvider`/`OpenLibraryProvider`) mappe la réponse externe vers une forme normalisée (`BookProviderLookupResult`) avant de la retourner — le JSON brut du fournisseur ne traverse jamais cette frontière, ni vers le contrôleur ni vers le mobile.

**Distinction `no_match` / `unsupported` / `provider_error`, jamais un simple booléen** — la proposition initiale (`match: boolean`) ne suffisait pas à distinguer trois situations réellement différentes pour le mobile : une recherche aboutie sans résultat (`no_match`, mise en cache), une catégorie pas encore implémentée (`unsupported` pour `cd`/`dvd` — aucune recherche n'est même tentée), et un échec technique de toute la chaîne de providers (`provider_error`, jamais mis en cache, car transitoire par nature). `match` est conservé comme raccourci (`status === 'matched'`) pour ne pas casser la lecture rapide de la réponse, mais `status` est la source de vérité. Un provider qui répond avec un résultat vide (pas de match chez lui) compte comme une réponse valide, pas un échec — `provider_error` n'est renvoyé que si **tous** les providers de la chaîne ont levé une exception.

**`country`/`countryCodes` volontairement absent du résultat book** — ni Google Books ni Open Library ne fournissent de signal fiable pour le pays de publication au sens d'`Item.countryCodes` (le champ `country` parfois présent chez Google Books reflète le catalogue régional de la requête, pas l'origine de l'ouvrage) : l'inventer aurait violé la règle « ne jamais fabriquer une valeur ». Le champ reste donc absent de la réponse pour l'instant ; à revoir si un provider fournissant une donnée réellement fiable est ajouté plus tard.

**Cache mémoire process-local, pas de Redis** — `BarcodeCacheService` (`Map` avec TTL, une entrée par `category:barcode`) évite de solliciter les providers à chaque scan répété du même produit et prépare MusicBrainz (Bloc futur), dont les limites de requêtes sont bien plus strictes que celles de Google Books. Ajouter Redis pour ce seul besoin aurait été disproportionné : le volume attendu (un item réellement scanné à la fois) et l'hébergement actuel (Render, une seule instance) ne le justifient pas. **Limites assumées, à revoir si le contexte change** : le cache est perdu à chaque redémarrage/redéploiement (jamais une source de vérité), et ne serait plus partagé si Render passait un jour à plusieurs instances (scaling horizontal) — chaque instance aurait alors son propre cache, avec un taux de succès réduit mais sans incohérence fonctionnelle. Un résultat "matched" est gardé 30 jours (une fiche livre change rarement), un "no_match" seulement 24h (laisse une chance à un ajout ultérieur chez un provider), un "provider_error" n'est jamais mis en cache.

**Aucune nouvelle dépendance HTTP** — `fetch`/`AbortController` natifs (Node 22, `engines` du monorepo) suffisent pour les appels sortants avec timeout ; pas de `@nestjs/axios`/`axios`, cohérent avec le choix déjà fait ailleurs dans l'API de ne pas ajouter de dépendance sans besoin réel démontré.
