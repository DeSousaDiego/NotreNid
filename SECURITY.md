# Politique de sécurité — Notre Nid

Notre Nid est un projet personnel à usage privé (deux utilisateurs). Cette politique reste néanmoins formalisée conformément à `docs/NOTRE_NID_PRD.md` (section 25) et parce que le dépôt peut être rendu public.

## Signaler une vulnérabilité

Ne pas ouvrir d'issue GitHub publique pour une vulnérabilité de sécurité. Contacter directement le propriétaire du dépôt : **[à renseigner par le propriétaire — adresse de contact dédiée à la sécurité]**.

Merci d'inclure : une description du problème, les étapes de reproduction, et l'impact potentiel estimé. Un accusé de réception sera envoyé dans un délai raisonnable (projet personnel, pas de SLA formel).

## Périmètre

- L'API (`apps/api`) et l'application mobile (`apps/mobile`).
- Les dépendances directes déclarées dans les `package.json` du monorepo.

Hors périmètre : l'infrastructure des fournisseurs tiers utilisés (hébergeur, base de données managée, stockage — signaler directement à ces fournisseurs).

## Mesures de sécurité en place

Résumé — détail dans `apps/api/src/main.ts`, `apps/api/src/auth/`, `apps/api/src/uploads/` et les tests associés :

| Mesure | Détail |
| --- | --- |
| Mots de passe | Hachés avec Argon2, jamais retournés par l'API. |
| Sessions | JWT access token courte durée + refresh token opaque, haché (HMAC-SHA256) avant stockage, rotatif et révocable individuellement (`logout`) ou globalement (`logout-all`). |
| Isolation multi-tenant | Chaque route vérifie l'appartenance de l'utilisateur au household ciblé contre la base de données — jamais de confiance dans un identifiant reçu du client (`HouseholdMembershipGuard`). Testé explicitement en e2e (le cas critique du PRD : un membre du household A ne peut jamais accéder aux données du household B). |
| En-têtes HTTP | `helmet()` actif sur toute l'API. |
| CORS | Liste blanche d'origines configurable (`CORS_ORIGINS`), refuse par défaut si non configurée. |
| Validation des entrées | `class-validator` avec `whitelist`/`forbidNonWhitelisted`/`transform` globaux — tout champ non déclaré dans un DTO est rejeté. |
| Limite de taille des requêtes | 1 Mo (JSON/urlencoded), 10 Mo (upload d'image, avec sa propre limite dédiée). |
| Rate limiting | 100 req/min par défaut, 10 req/min sur `/auth/register`, `/auth/login`, `/auth/refresh` (protection contre le bourrage d'identifiants). |
| Validation des fichiers uploadés | Type réel vérifié par signature binaire (magic bytes), jamais par l'extension ni le `Content-Type` déclaré ; noms de fichiers non prédictibles (UUID généré côté serveur, jamais celui fourni par le client) ; le nom de fichier est revalidé contre un format fixe avant toute suppression, indépendamment du driver de stockage actif (voir `apps/api/src/uploads/uploads.service.ts`). |
| Logs | Aucune donnée sensible journalisée ; `requestId` propagé de bout en bout pour la corrélation sans exposer de secret. |
| Erreurs | Aucune stack trace renvoyée en production ; format d'erreur standard (`docs/API.md`). |
| Secrets | Jamais commités ; `.env.example` ne contient que des valeurs de développement explicitement fictives ; secrets JWT dédiés en CI, distincts de ceux de développement et de production. |

## Gestion des secrets

- `.env` est ignoré par Git (`.gitignore`) — jamais commité, sous aucune forme.
- Les secrets de production (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, identifiants de stockage, SMTP) sont injectés uniquement via la configuration de la plateforme d'hébergement — jamais dans un fichier du dépôt, jamais dans une image Docker (voir `docs/DEPLOYMENT.md`).
- Procédure de rotation d'un secret : voir `docs/OPERATIONS.md#changer-un-secret`.

## Versions supportées

Projet à version unique (pas de branches de maintenance parallèles) — seule la branche `main` reçoit des correctifs de sécurité.

## Dépendances

Aucun processus de mise à jour automatisée des dépendances (type Dependabot) n'est configuré dans cette V1. Vérification manuelle recommandée avant chaque phase de développement significative (`pnpm outdated`), en particulier pour les dépendances liées à l'authentification (`argon2`, `@nestjs/jwt`) et au stockage (`@aws-sdk/client-s3`).
