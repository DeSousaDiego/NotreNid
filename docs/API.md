# API — Notre Nid

Référence rapide du contrat REST. Le contrat **normatif et à jour** est le document OpenAPI généré depuis le code réel :

- Interactif (développement uniquement) : `http://localhost:3000/api/v1/docs`
- Figé et versionné dans le dépôt : [docs/openapi.json](openapi.json), régénéré par `pnpm --filter @notre-nid/api run export:openapi` — la CI échoue si ce fichier n'est pas à jour (voir `.github/workflows/ci.yml`).

Ce document explique la structure générale ; pour le détail exact d'une route (paramètres, schémas, codes de réponse), se référer à `docs/openapi.json` ou à `/api/v1/docs`.

## Conventions

- Préfixe : `/api/v1`.
- Authentification : `Authorization: Bearer <accessToken>` sur toutes les routes privées.
- Toutes les routes sous `/households/:householdId/...` vérifient l'appartenance de l'utilisateur au household avant tout traitement (`HouseholdMembershipGuard`).
- Corps JSON validés strictement (`whitelist`, `forbidNonWhitelisted`, `transform`) — un champ inconnu est rejeté, pas ignoré silencieusement.
- Limite de taille : 1 Mo pour les corps JSON/urlencoded, 10 Mo pour les uploads d'images (route dédiée).
- Rate limiting : 100 req/min par défaut, 10 req/min sur `/auth/register`, `/auth/login`, `/auth/refresh`.

## Format standard des erreurs

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Les données envoyées sont invalides.",
  "details": [],
  "requestId": "..."
}
```

`code` est une chaîne stable exploitable par le mobile pour distinguer les cas (ex. `LAST_OWNER_CANNOT_LEAVE`, `FILE_TOO_LARGE`, `INVALID_FILE_TYPE`) — voir `apps/api/src/common/filters/http-exception.filter.ts` et `apps/api/src/common/exceptions/app-exception.ts`. `requestId` est propagé depuis l'en-tête `x-request-id` (ou généré) et permet de corréler une erreur signalée par un utilisateur avec les logs serveur (voir `docs/OPERATIONS.md`).

## Groupes de routes

| Groupe | Base | Résumé |
| --- | --- | --- |
| Santé | `/health`, `/health/ready` | Liveness / readiness (vérifie réellement PostgreSQL) — sans authentification. |
| Authentification | `/auth/*` | Inscription, connexion, refresh, déconnexion (simple/globale), profil courant. |
| Households | `/households/*` | CRUD, membres, rôles, `leave`. |
| Invitations | `/households/:id/invitations`, `/invitations/accept`, `/invitations/:id/revoke` | Génération d'un code (email facultatif), liste, acceptation par code, révocation. |
| Catégories | `/households/:id/categories/*` | Catégories système (lecture seule) + personnalisées (OWNER/ADMIN). |
| Items | `/households/:id/items/*` | CRUD, recherche, filtres, tri, pagination, archivage/restauration (suppression logique). |
| Uploads | `/households/:id/uploads` | Upload/suppression d'une image de couverture. |
| Statistiques | `/households/:id/stats` | Compteurs et ajouts récents. |
| Exports | `/households/:id/exports/{json,csv}` | Export complet de la collection. |

Détail complet des paramètres, du format de pagination (`{ data, meta: { page, pageSize, totalItems, totalPages } }`) et des schémas de requête/réponse : voir `docs/openapi.json` ou `/api/v1/docs`.

## Client typé

Le mobile ne doit jamais appeler ces routes directement — `packages/api-client` les expose sous forme de fonctions typées (`src/endpoints/*.ts`), et `packages/api-client/src/contract.ts` vérifie à la compilation que chaque route utilisée existe bien dans `docs/openapi.json` (types générés par `openapi-typescript`, `pnpm --filter @notre-nid/api-client run generate:types`). Toute dérive entre le client et le contrat réel fait échouer `pnpm typecheck`.

## Versionnement du contrat

Le préfixe `/api/v1` réserve la possibilité d'une v2 future sans casser les clients existants. Toute modification cassante d'une route existante (renommage de champ, changement de type, suppression) doit :

1. être accompagnée d'une migration Prisma si elle touche le modèle de données ;
2. régénérer `docs/openapi.json` (`export:openapi`) et les types du client (`generate:types`) ;
3. être documentée dans `CHANGELOG.md`.

Voir la règle permanente correspondante dans `CLAUDE.md`.
