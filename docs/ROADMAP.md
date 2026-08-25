# Roadmap future — Notre Nid

Fonctionnalités envisageables après la première version (V1, phases 1 à 5), reprises de `docs/NOTRE_NID_PRD.md` section 27. **Aucune de ces fonctionnalités n'est implémentée** dans la V1 — conformément au PRD, aucun bouton ni écran factice n'y fait référence dans l'application actuelle.

Aucun ordre de priorité n'est fixé ici : à arbitrer par le propriétaire du produit en fonction de l'usage réel après mise en production.

## Capture et enrichissement

- Scan de code-barres ISBN (livres) et récupération automatique des métadonnées (titre, auteur, couverture) depuis une API externe (ex. Open Library, Google Books).
- Scan de codes-barres pour CD/DVD (EAN/UPC) avec une logique équivalente.
- Détection de doublons à l'ajout (par ISBN/titre + auteur approchant).
- Import CSV (en complément de l'export déjà disponible en V1).

## Fonctionnalités sociales et de partage

- Wishlist par utilisateur, distincte de la collection possédée.
- Prêts et emprunts : suivi de qui a emprunté quel item du household, avec rappel de retour.
- Partage en lecture seule d'un household ou d'une sélection d'items avec une personne hors du foyer (ex. lien public temporaire).
- Authentification sociale (Google/Apple) en complément de l'email/mot de passe actuel.
- Passkeys (WebAuthn) comme méthode d'authentification sans mot de passe.

## Organisation

- Tags libres, en complément des catégories structurées.
- Collections multiples au sein d'un même household (ex. séparer les livres jeunesse du reste).
- Historique complet des modifications d'un item (au-delà des logs d'audit déjà journalisés en base — `AuditLog` — non exposés dans l'UI en V1).

## Plateforme

- Application web (le mobile reste la plateforme prioritaire de la V1 ; l'API a été conçue dès le départ pour être consommée par plusieurs clients — voir `docs/ARCHITECTURE.md`).
- Mode offline-first avec synchronisation réelle (la V1 s'appuie sur le cache TanStack Query, pas sur une file de mutations hors ligne — voir `docs/NOTRE_NID_PRD.md` section 11).
- Notifications (rappels de prêt, invitations en attente, ajouts récents d'un autre membre).
- Statistiques avancées (tendances dans le temps, répartition par décennie de publication, etc. — au-delà des compteurs simples de la V1).

## Recherche

- Recherche full-text PostgreSQL native (`tsvector`/`tsquery`) si le volume ou la pertinence de la recherche `ILIKE` actuelle devient limitant — voir `docs/DECISIONS.md` (« pourquoi pas d'Elasticsearch »). Aucun changement d'infrastructure requis, contrairement à une migration vers un moteur de recherche externe.

## Voir aussi

- `docs/NOTRE_NID_PRD.md` section 27 — texte source de cette roadmap.
- `docs/IMPLEMENTATION_PLAN.md` — phases 1 à 5 déjà livrées ou en cours.
