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
