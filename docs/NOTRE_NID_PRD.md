# NOTRE NID

## Cahier des charges complet & prompt de création pour Claude Code

*Application mobile de gestion de collection partagée*

Version 1.0  •  24 juillet 2026

Document destiné à guider Claude Code dans la création d’une application réellement exécutable, testée, déployable et installable.

# Sommaire

> Les 32 sections constituent un prompt opérationnel unique. Le document peut être fourni à Claude Code sous forme Markdown, puis exécuté phase par phase depuis la racine du dépôt.

| 1. Contexte fonctionnel | 17. Documentation OpenAPI |
| --- | --- |
| 2. Objectifs de la première version | 18. Format standard des erreurs |
| 3. Stack technique imposée | 19. Observabilité |
| 4. Direction artistique et expérience utilisateur | 20. CI GitHub Actions |
| 5. Modèle de données | 21. Docker et production |
| 6. Autorisations et sécurité métier | 22. Sauvegardes et restauration |
| 7. API REST attendue | 23. Construction et installation mobile |
| 8. Recherche | 24. README principal |
| 9. Application mobile | 25. Autres documents obligatoires |
| 10. Gestion des images | 26. Configuration et instructions permanentes pour Claude Code |
| 11. Expérience hors connexion | 27. Roadmap future |
| 12. Environnement local | 28. Méthode de travail obligatoire |
| 13. Variables d’environnement | 29. Vérifications finales obligatoires |
| 14. Migrations et données de démonstration | 30. Checklist manuelle finale |
| 15. Tests | 31. Définition de “terminé” |
| 16. Qualité du code | 32. Contraintes de réponse pendant le travail |

## Mission : créer une application complète de gestion de collection partagée

> Positionnement du produit
> Notre Nid n’est pas un logiciel de gestion générique. C’est un objet personnel et affectif, créé comme cadeau pour les trois ans d’un couple. Les choix de design doivent privilégier la chaleur, la simplicité, la confiance et le plaisir d’utilisation, sans réduire les exigences de qualité technique.

Tu es l’agent principal responsable de l’architecture, de l’implémentation, des tests, de la documentation et de la préparation au déploiement d’une application mobile complète. Tu travailles dans un dépôt Git initialement vide ou presque vide. Tu dois construire une base de code réellement exécutable et maintenable. Ne te limite pas à produire des exemples, des pseudo-fichiers, une maquette ou une simple démonstration.

Le résultat final doit comprendre :

- une API backend ;

- une base de données PostgreSQL ;

- une application mobile Android et iOS ;

- une documentation complète ;

- un environnement de développement local reproductible ;

- des tests ;

- une configuration Docker ;

- une configuration CI ;

- une procédure de déploiement ;

- une procédure pour générer une application mobile installable ;

- une checklist expliquant les opérations manuelles restantes.

## 1. Contexte fonctionnel

L’application sert à un couple souhaitant gérer une collection commune d’objets.

Les premières catégories sont :

- livres ;

- CD ;

- DVD.

D’autres catégories devront pouvoir être ajoutées plus tard sans réécrire toute l’application. Chaque objet est enregistré dans un espace partagé appelé Household. Un objet appartient donc fonctionnellement à un Household, ce qui détermine qui peut le consulter et le modifier. La propriété réelle de l’objet est représentée séparément par un ou plusieurs utilisateurs.

Exemples :

- un livre appartenant uniquement à l’utilisateur A ;

- un CD appartenant uniquement à l’utilisateur B ;

- un DVD appartenant aux deux utilisateurs.

La règle fondamentale est donc :

```text
Household = espace de visibilité et de collaboration
Item owners = personnes auxquelles l’objet appartient réellement
```

Ne crée pas un simple champ ownerId dans la table des items. Utilise une relation plusieurs-à-plusieurs entre les items et les utilisateurs. L’application doit fonctionner depuis plusieurs téléphones et synchroniser les données via une API hébergée. Une application web pourra être ajoutée plus tard. Toute la logique métier doit donc être exposée proprement par l’API et ne pas être enfermée dans l’application mobile.

## 2. Objectifs de la première version

La première version doit permettre de :

1. créer un compte ;

2. se connecter et se déconnecter ;

3. maintenir une session avec access token et refresh token ;

4. créer un household ;

5. inviter un autre utilisateur dans un household ;

6. rejoindre un household avec une invitation ;

7. consulter les membres du household ;

8. afficher les catégories disponibles ;

9. créer une catégorie personnalisée ;

10. ajouter un item ;

11. sélectionner un ou plusieurs propriétaires parmi les membres ;

12. consulter la collection ;

13. rechercher un item ;

14. filtrer par catégorie ;

15. filtrer par propriétaire ;

16. filtrer par état ;

17. trier les résultats ;

18. consulter le détail d’un item ;

19. modifier un item ;

20. archiver un item ;

21. restaurer un item archivé ;

22. ajouter une image de couverture ;

23. afficher les ajouts récents ;

24. afficher des statistiques simples ;

25. exporter la collection en JSON et CSV ;

26. gérer correctement les erreurs réseau ;

27. conserver la session sur mobile ;

28. afficher des états de chargement, des écrans vides et des messages d’erreur clairs.

L’application doit être utilisable en français. Prépare néanmoins l’architecture pour une future internationalisation.

## 3. Stack technique imposée

Utilise une monorepo TypeScript.

### Gestion du monorepo

Utilise :

- pnpm ;

- les workspaces pnpm ;

- Turborepo si cela apporte une valeur réelle sans complexité excessive.

Structure cible :

```text
/
├── apps/
│
├── api/
│
└── mobile/
├── packages/
│
├── api-client/
│
├── shared/
│
├── config/
│
└── eslint-config/
├── infrastructure/
├── docs/
├── .github/
├── `docker-compose.yml`
├── pnpm-workspace.yaml
├── package.json
├── README.md
└── `.env.example`
```

### Backend

Utilise :

- Node.js en version LTS ;

- NestJS ;

- REST ;

- Prisma ORM ;

- PostgreSQL ;

- Swagger/OpenAPI ;

- class-validator ou une solution de validation cohérente avec NestJS ;

- JWT access token ;

- refresh tokens renouvelables et révocables ;

- Argon2 pour les mots de passe ;

- Jest pour les tests ;

- Supertest pour les tests d’intégration.

### Application mobile

Utilise :

- React Native ;

- Expo ;

- Expo Router ;

- TypeScript strict ;

- TanStack Query pour les données serveur ;

- React Hook Form ;

- Zod pour les formulaires côté client ;

- Expo SecureStore pour les secrets et tokens ;

- un système de thème ;

- une architecture compatible Android et iOS ;

- EAS pour les builds installables.

Ne mets jamais les tokens dans un stockage mobile non sécurisé.

### API client partagé

Génère ou construis un client API typé à partir du contrat OpenAPI. L’application mobile ne doit pas contenir des appels HTTP dispersés dans les composants.

Centralise :

- la configuration réseau ;

- l’URL de l’API ;

- l’authentification ;

- le rafraîchissement des tokens ;

- la gestion des erreurs ;

- les types des requêtes et réponses.

## 4. Direction artistique et expérience utilisateur

> Intention centrale
> L’application doit évoquer un petit foyer dans une forêt enchantée : lumineux, calme, chaleureux et personnel. Elle doit ressembler à un carnet partagé où le couple conserve ses livres, ses musiques, ses films et ses souvenirs, et non à un outil d’inventaire professionnel.

Le nom de l’application est « Notre Nid ». Son identité visuelle et son vocabulaire doivent soutenir l’idée d’un foyer commun qui grandit au fil des objets ajoutés. Le résultat doit être affectif sans être infantile, poétique sans être kitsch, illustré sans nuire à la lisibilité, et suffisamment structuré pour rester crédible comme application publiée sur les stores.

### 4.1 Principes directeurs

- Clarté avant décoration : aucun motif, aucune illustration et aucune animation ne doit ralentir la compréhension d’un écran ou réduire la lisibilité.

- Chaleur avant froideur : éviter l’esthétique dashboard, SaaS, banque, ERP ou outil d’administration.

- Nature sans surcharge : employer les références à la forêt comme accents, jamais comme texture omniprésente.

- Cohérence avant variété : utiliser un système de tokens, des composants réutilisables et des règles stables plutôt que des styles isolés par écran.

- Accessibilité par défaut : contraste suffisant, zones tactiles adaptées, tailles de texte lisibles, états non communiqués uniquement par la couleur et prise en charge de la réduction des animations.

- Qualité native : l’interface doit respecter les conventions Android et iOS, les safe areas, le clavier, les gestes de retour et les états système.

### 4.2 Univers visuel

L’univers peut s’inspirer d’une cabane dans les bois, d’un cottage chaleureux, de carnets illustrés, de contes forestiers et d’une forêt à la fin de l’été ou au début de l’automne. Il doit évoquer la mousse, les feuilles, le bois clair, les champignons, les fougères, les petites fleurs et la lumière chaude.

- Ambiance principale : claire, douce, naturelle, intime et rassurante.

- Éléments décoratifs autorisés : petites branches, feuilles, fougères, glands, champignons, baies, papillons, lucioles et fleurs sauvages.

- Éléments décoratifs interdits : arrière-plans photographiques chargés, textures fortes derrière le texte, brillances excessives, personnages omniprésents ou animations permanentes.

- Le style « fée de la forêt » doit rester élégant et contemporain, pas enfantin ni inspiré directement d’une licence existante.

### 4.3 Interface claire

La version initiale doit utiliser un thème clair comme thème principal. Le fond ne doit pas être blanc pur : employer un crème ou un ivoire légèrement chaud. Un éventuel thème sombre pourra être ajouté plus tard, mais ne doit pas détourner la première version de sa direction visuelle principale.

- Fond principal chaud et peu contrasté.

- Surfaces et cartes légèrement différenciées du fond, sans empilement excessif de couches.

- Ombres très légères, réservées aux éléments qui doivent apparaître au-dessus du plan courant.

- Bordures douces et fines pour les champs, filtres et cartes.

- Éviter les aplats gris froids et les noirs purs.

### 4.4 Palette et tokens de couleur

Implémente une palette sémantique centralisée. Les valeurs suivantes constituent une base de travail et peuvent être ajustées légèrement après vérification du contraste, mais leur rôle doit rester stable. Aucun composant ne doit contenir une couleur métier écrite en dur.

| Token | Valeur cible | Usage | Exigence |
| --- | --- | --- | --- |
| background | #FFF8E8 | Fond principal crème chaud | Ne pas utiliser du blanc pur |
| surface | #FFFCF4 | Cartes, menus et champs | Différence subtile avec le fond |
| primary | #355A3A | Actions principales, titres, navigation | Vert forêt accessible |
| primaryMuted | #8CA879 | Filtres, états secondaires, décor | Vert sauge non critique |
| secondary | #E9782F | CTA, ajout, accent actif | Orange automnal, usage mesuré |
| accent | #EBA94B | Badges, détails et illustrations | Jamais pour du texte long |
| text | #26312A | Texte principal | Contraste élevé |
| textMuted | #687269 | Métadonnées et aides | Contraste vérifié |
| border | #D8E2D1 | Bordures et séparateurs | Éviter les grilles lourdes |
| danger | #A64236 | Suppression, erreur et alerte | Toujours accompagné d’un libellé |

### 4.5 Typographie

- Utiliser une police d’interface lisible, douce et légèrement arrondie, par exemple Nunito Sans ou une alternative compatible avec Expo. Prévoir un fallback système fiable.

- Une police de caractère plus expressive peut être utilisée uniquement pour le logotype « Notre Nid » et certains grands titres de marque. Elle ne doit jamais être utilisée pour les formulaires, listes, métadonnées ou textes longs.

- Définir une échelle typographique centralisée : display, title, section, body, label, caption et helper.

- Conserver une taille de corps confortable, prendre en charge l’agrandissement du texte et tester les écrans avec les réglages d’accessibilité.

- Limiter le nombre de graisses. L’interface doit principalement utiliser regular, medium et semibold.

### 4.6 Design system et composants

Créer un système de thème centralisé et typé. Les composants visuels ne doivent pas dépendre directement des écrans. Les tokens doivent couvrir les couleurs, espacements, rayons, typographies, élévations, tailles d’icônes et durées d’animation.

- Grille d’espacement basée sur 4 points, avec valeurs nommées et cohérentes.

- Rayons modérés et organiques : petits pour les champs et badges, moyens pour les cartes, plus généreux pour les panneaux et modales.

- Zones tactiles d’au moins 44 × 44 points, même lorsque l’icône visible est plus petite.

- Composants obligatoires : Button, IconButton, TextField, PasswordField, SearchField, Select, Chip, CategoryBadge, ConditionBadge, OwnerAvatarGroup, ItemCard, EmptyState, LoadingSkeleton, ErrorState, ConfirmDialog, BottomSheet, Toast et ScreenContainer.

- États complets pour chaque composant interactif : default, pressed, focused, disabled, loading, error et selected lorsque pertinent.

- Aucune couleur brute, marge arbitraire ou taille de police isolée dans les écrans. Les exceptions doivent être rares et documentées.

- Les composants doivent accepter le mode clair et rester préparés pour un futur thème sombre, sans implémenter ce dernier au détriment du MVP.

### 4.7 Cartes, listes et couvertures

- Mettre la couverture de l’item en valeur sans qu’elle domine l’écran. Utiliser un ratio stable par type d’objet et un placeholder illustré lorsqu’aucune image n’est disponible.

- Les cartes de collection doivent rester compactes : couverture, titre, information secondaire, badge de catégorie, propriétaires et menu d’action.

- Prévoir un mode liste comme vue principale. Une vue grille pourra être ajoutée plus tard, mais ne doit pas retarder la première version.

- Les avatars des propriétaires doivent être reconnaissables et accompagnés d’un libellé accessible. Ne pas transmettre la propriété uniquement par la position ou la couleur.

- Les séparateurs doivent être subtils. Éviter les cartes imbriquées dans d’autres cartes sans nécessité.

### 4.8 Iconographie et illustrations

- Utiliser une seule bibliothèque d’icônes principale, avec un style arrondi et une épaisseur cohérente.

- Créer ou intégrer des petites illustrations forestières locales et optimisées. Elles ne doivent pas dépendre d’URLs externes ni ralentir l’affichage.

- Employer les illustrations dans l’écran de connexion, les états vides, certains en-têtes et des moments de célébration discrets.

- Prévoir des variantes simples compatibles avec les différentes tailles d’écran et la densité de pixels.

- Ne pas copier une œuvre, une marque, un personnage ou une direction artistique protégée. Utiliser des créations originales ou des ressources sous licence compatible, avec attribution documentée si nécessaire.

### 4.9 Mouvement et retours d’interaction

- Animations courtes, discrètes et fonctionnelles : fondu, léger déplacement vertical, transition d’état et feedback de pression.

- Éviter les animations continues, les particules permanentes et les transitions qui retardent une action.

- Respecter le réglage système de réduction des animations.

- Utiliser le retour haptique avec parcimonie pour les confirmations importantes, les sélections et les erreurs, sans le rendre obligatoire à la compréhension.

- Ne jamais afficher un succès avant confirmation du serveur.

### 4.10 Ton éditorial et microcopy

Le vocabulaire doit être chaleureux et humain, mais rester explicite. Les formulations poétiques peuvent apparaître dans les moments non critiques. Les erreurs, autorisations, suppressions et actions techniques doivent conserver un langage direct et précis.

- Bienvenue : « Bienvenue dans votre nid. »

- Ajout réussi : « Cet objet a rejoint votre nid. »

- Collection vide : « Votre nid est encore vide. Ajoutez votre premier trésor. »

- Recherche sans résultat : « Aucun objet ne correspond à cette recherche. »

- Erreur réseau : « Impossible de joindre le service. Vérifiez votre connexion et réessayez. »

- Suppression logique : employer « Archiver » dans l’interface et expliquer clairement que l’élément pourra être restauré.

### 4.11 Navigation et écrans

La navigation inférieure doit contenir cinq destinations stables : Accueil, Collection, Ajouter, Recherche et Profil. L’action Ajouter peut être visuellement accentuée en orange, sans casser les conventions de navigation ni devenir un bouton flottant inaccessible.

- Connexion et inscription.

- Création d’un household ou acceptation d’une invitation.

- Accueil avec statistiques et ajouts récents.

- Collection avec recherche, tri, filtres, pagination et pull-to-refresh.

- Panneau ou écran de filtres.

- Recherche globale.

- Détails d’un livre, d’un CD, d’un DVD et d’une catégorie personnalisée.

- Ajout en plusieurs étapes avec sauvegarde locale du brouillon pendant la session.

- Modification, archivage et restauration.

- Profil, membres, invitations, catégories, exports, paramètres et déconnexion.

### 4.12 Référence visuelle

Le mockup fourni avec le projet constitue la référence principale pour la palette, l’ambiance, les espacements, les cartes, les boutons, les motifs forestiers et la hiérarchie visuelle. Il ne constitue pas une spécification pixel-perfect : l’implémentation doit corriger les incohérences éventuelles, respecter les contraintes natives et conserver une architecture de composants maintenable.

> Référence visuelle : fournir également le mockup clair de « Notre Nid » avec ce document.

> Référence de direction artistique — thème clair, vert forêt, orange automnal et motifs naturels.

> Critères d’acceptation de la direction artistique
> La section est considérée comme correctement implémentée si tous les écrans utilisent les mêmes tokens, si aucun texte critique n’est illisible, si les éléments forestiers ne masquent aucune information, si l’application reste utilisable avec une taille de texte agrandie, si les interactions ont des états complets et si l’ensemble évoque clairement « Notre Nid » sans ressembler à un logiciel de gestion professionnel.

## 5. Modèle de données

Conçois un schéma Prisma correctement normalisé. Utilise des UUID ou des identifiants robustes.

Toutes les tables importantes doivent avoir :

```text
id
createdAt
updatedAt
```

Les noms exacts peuvent être ajustés si nécessaire, mais les concepts suivants doivent exister.

### User

Champs principaux :

```text
id
email
passwordHash
displayName
avatarUrl
createdAt
updatedAt
```

Contraintes :

- email unique ;

- email normalisé ;

- mot de passe jamais retourné par l’API.

### Household

```text
id
name
createdById
createdAt
updatedAt
```

### HouseholdMember

```text
id
householdId
userId
role
joinedAt
```

Rôles :

```text
OWNER
ADMIN
MEMBER
```

Contrainte unique :

householdId + userId

### HouseholdInvitation

```text
id
householdId
email
tokenHash
invitedById
expiresAt
acceptedAt
createdAt
```

Ne stocke pas le token d’invitation en clair si cela peut être évité.

### Category

Prévois à la fois des catégories système et personnalisées.

```text
id
```

householdId nullable

```text
name
slug
icon
isSystem
metadataSchema
createdAt
updatedAt
```

Catégories système initiales :

```text
BOOK
CD
DVD
```

`metadataSchema` peut être un JSON définissant les champs spécifiques de la catégorie.

Ne crée pas une architecture excessivement dynamique si elle rend la validation impossible. Les trois catégories principales peuvent avoir des champs structurés, mais l’ajout futur de catégories doit rester possible.

### Item

```text
id
householdId
categoryId
title
description
condition
coverImageUrl
notes
createdById
updatedById
archivedAt
createdAt
updatedAt
```

États possibles :

```text
NEW
VERY_GOOD
GOOD
FAIR
POOR
```

### ItemOwner

```text
id
itemId
userId
createdAt
```

Contrainte unique :

itemId + userId Lorsqu’un propriétaire est ajouté, vérifie qu’il est membre du même household que l’item.

### Métadonnées spécialisées

Prévois une stratégie claire et documentée.

Option recommandée :

- champs communs dans Item ;

- tables spécialisées en relation un-à-un.

### BookMetadata

```text
itemId
author
isbn
publisher
publicationYear
language
pageCount
```

### CdMetadata

```text
itemId
artist
album
releaseYear
label
format
```

### DvdMetadata

```text
itemId
director
releaseYear
edition
region
format
durationMinutes
```

Assure-toi qu’un item ne possède que le type de métadonnées correspondant à sa catégorie système. Pour les catégories personnalisées, utilise une structure JSON validée par le schéma de la catégorie.

### RefreshSession

Prévois des sessions révocables :

```text
id
userId
tokenHash
deviceName
expiresAt
revokedAt
createdAt
lastUsedAt
```

### AuditLog

Prévois un historique minimal :

```text
id
householdId
userId
action
entityType
entityId
metadata
createdAt
```

Journaliser au minimum :

- création ;

- modification ;

- archivage ;

- restauration ;

- changement de propriétaires ;

- invitation d’un membre.

## 6. Autorisations et sécurité métier

Toutes les routes privées doivent vérifier l’utilisateur authentifié. Un utilisateur ne peut accéder qu’aux données des households dont il est membre. Ne fais jamais confiance à un householdId reçu du client sans vérifier l’appartenance.

Règles minimales :

- un membre peut consulter les items ;

- un membre peut créer et modifier les items ;

- un membre peut archiver un item ;

- seuls OWNER et ADMIN peuvent gérer les catégories personnalisées ;

- seuls OWNER et ADMIN peuvent inviter ou retirer des membres ;

- le dernier OWNER ne peut pas quitter ou être supprimé ;

- un item doit avoir au moins un propriétaire ;

- tous les propriétaires doivent appartenir au household de l’item ;

- une invitation doit expirer ;

- les refresh tokens doivent pouvoir être révoqués ;

- les mots de passe doivent être hashés avec Argon2 ;

- les réponses ne doivent jamais contenir de hash ou secret.

Ajoute :

- validation globale des DTO ;

- helmet ;

- CORS configurable ;

- rate limiting sur l’authentification ;

- limites sur la taille des requêtes ;

- validation des fichiers uploadés ;

- gestion centralisée des exceptions ;

- logs structurés ;

- identifiant de corrélation par requête ;

- configuration différente entre développement, test et production.

## 7. API REST attendue

Préfixe :

```text
/api/v1
```

### Santé

```text
GET /health
GET /health/ready
```

### Authentification

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /auth/logout-all
GET /auth/me
```

### Households

```text
GET
POST
GET
/households
/households
/households/:householdId
PATCH /households/:householdId
DELETE /households/:householdId
```

### Membres

```text
GET
/households/:householdId/members
PATCH /households/:householdId/members/:userId
DELETE /households/:householdId/members/:userId
POST
/households/:householdId/leave
```

### Invitations

```text
POST /households/:householdId/invitations
GET /households/:householdId/invitations
POST /invitations/:token/accept
POST /invitations/:invitationId/revoke
```

Pour le développement, si aucun service email n’est configuré, expose clairement le lien d’invitation dans les logs de développement ou dans un outil local de capture d’emails. Ne fais jamais cela en production.

### Catégories

```text
GET
/households/:householdId/categories
POST
/households/:householdId/categories
PATCH /households/:householdId/categories/:categoryId
DELETE /households/:householdId/categories/:categoryId
```

Les catégories système ne doivent pas être supprimables.

### Items

```text
GET
/households/:householdId/items
POST
/households/:householdId/items
GET
/households/:householdId/items/:itemId
PATCH /households/:householdId/items/:itemId
DELETE /households/:householdId/items/:itemId
POST
/households/:householdId/items/:itemId/restore
```

Le DELETE doit faire un archivage logique.

Paramètres de liste :

```text
search
categoryId
ownerId
condition
archived
createdById
sort
order
page
pageSize
```

Ajoute une pagination claire avec métadonnées :

```text
{
"data": [],
"meta": {
"page": 1,
"pageSize": 20,
"totalItems": 0,
"totalPages": 0
}
}
```

### Uploads

```text
POST
/households/:householdId/uploads
DELETE /households/:householdId/uploads/:uploadId
```

Prévois une abstraction de stockage :

- stockage local en développement ;

- stockage S3-compatible ou Supabase Storage en production.

### Statistiques

```text
GET /households/:householdId/stats
```

Retourner notamment :

- nombre total d’items actifs ;

- nombre par catégorie ;

- nombre par propriétaire ;

- ajouts récents ;

- nombre d’items archivés.

### Exports

```text
GET /households/:householdId/exports/json
GET /households/:householdId/exports/csv
```

## 8. Recherche

Pour la première version :

- recherche insensible à la casse ;

- recherche sur le titre ;

- auteur ;

- artiste ;

- album ;

- réalisateur ;

- ISBN ;

- notes si raisonnable.

Prépare une architecture permettant plus tard d’utiliser la recherche full-text PostgreSQL. Ne mets pas en place Elasticsearch. La complexité ne serait pas justifiée pour cette application.

## 9. Application mobile

### État d’authentification

Implémente :

- restauration de session au lancement ;

- stockage sécurisé ;

- renouvellement automatique de l’access token ;

- déconnexion lorsque le refresh token n’est plus valide ;

- protection des routes authentifiées ;

- écran de chargement initial ;

- distinction entre erreur réseau et erreur d’authentification.

### Sélection du household

Si l’utilisateur appartient à un seul household, sélectionne-le automatiquement. S’il appartient à plusieurs households, laisse-le choisir.

Mémorise le dernier household utilisé.

### Accueil

Afficher :

- message de bienvenue ;

- statistiques ;

- ajouts récents ;

- raccourci vers l’ajout ;

- raccourci vers la collection.

### Collection

Afficher une liste paginée ou infinie avec :

- couverture ;

- titre ;

- informations secondaires ;

- badge de catégorie ;

- avatars des propriétaires ;

- état ;

- recherche ;

- filtres ;

- tri ;

- pull-to-refresh ;

- écran vide ;

- skeletons de chargement.

### Ajout d’un item

Créer un formulaire en plusieurs étapes :

### Étape 1

- catégorie ;

- titre ;

- état ;

- description ;

- notes.

### Étape 2

Champs spécifiques à la catégorie.

### Étape 3

- un ou plusieurs propriétaires ;

- image de couverture ;

- récapitulatif ;

- confirmation.

Valider chaque étape. Empêcher les doubles soumissions.

### Détail

Afficher :

- couverture ;

- titre ;

- catégorie ;

- propriétaires ;

- état ;

- métadonnées ;

- notes ;

- créateur ;

- dates ;

- actions modifier et archiver.

### Profil et paramètres

Afficher :

- utilisateur courant ;

- household courant ;

- membres ;

- invitations ;

- catégories ;

- éléments archivés ;

- export ;

- paramètres ;

- déconnexion.

## 10. Gestion des images

En développement :

- permettre un stockage local via un volume Docker ou un dossier ignoré par Git.

En production :

- utiliser un stockage objet S3-compatible ou Supabase Storage ;

- documenter la configuration ;

- valider les MIME types ;

- définir une taille maximale ;

- générer des noms de fichiers non prédictibles ;

- refuser les formats non autorisés ;

- ne pas faire confiance à l’extension du fichier.

Formats acceptés :

```text
JPEG
PNG
WebP
```

Prévoir une image placeholder si aucune couverture n’est fournie.

## 11. Expérience hors connexion

La version initiale n’a pas besoin d’être entièrement offline-first.

Elle doit toutefois :

- conserver les données déjà récupérées dans le cache de TanStack Query ;

- afficher une erreur claire si l’API est indisponible ;

- permettre de réessayer ;

- ne pas perdre silencieusement un formulaire ;

- éviter d’annoncer un succès avant confirmation du serveur.

Documente une évolution future possible vers une vraie synchronisation hors ligne.

## 12. Environnement local

Créer un `docker-compose.yml` permettant de lancer au minimum :

- PostgreSQL ;

- l’API, si pertinent ;

- un service local de capture d’emails tel que Mailpit ;

- éventuellement MinIO pour simuler un stockage S3.

La commande de démarrage local doit être simple.

Exemple attendu :

pnpm install cp `.env.example` .env docker compose up -d pnpm db:migrate pnpm db:seed pnpm dev Adapte les commandes à l’implémentation réelle.

Toutes les commandes documentées doivent exister et fonctionner.

## 13. Variables d’environnement

Créer des fichiers `.env.example` complets sans secret réel.

Prévoir notamment :

```text
NODE_ENV
PORT
DATABASE_URL
JWT_ACCESS_SECRET
JWT_ACCESS_TTL
JWT_REFRESH_SECRET
JWT_REFRESH_TTL
CORS_ORIGINS
API_PUBLIC_URL
MOBILE_PUBLIC_API_URL
STORAGE_DRIVER
STORAGE_BUCKET
STORAGE_ENDPOINT
STORAGE_REGION
STORAGE_ACCESS_KEY
STORAGE_SECRET_KEY
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
SENTRY_DSN
LOG_LEVEL
```

Pour Expo, respecter les conventions nécessaires aux variables publiques. Documenter précisément lesquelles sont intégrées au bundle mobile et ne doivent jamais contenir de secret.

## 14. Migrations et données de démonstration

Créer :

- le schéma Prisma ;

- la première migration ;

- un script de seed ;

- des données réalistes mais fictives.

Le seed doit inclure :

- deux utilisateurs de démonstration ;

- un household commun ;

- les catégories livre, CD et DVD ;

- plusieurs items ;

- des items à propriétaire unique ;

- des items appartenant aux deux ;

- différentes conditions ;

- un item archivé.

En développement uniquement, documenter les identifiants de connexion de démonstration dans le README. Ne mets jamais ces comptes dans une configuration de production.

## 15. Tests

### Backend

Ajouter :

- tests unitaires des services critiques ;

- tests des règles d’autorisation ;

- tests des propriétaires d’items ;

- tests de l’authentification ;

- tests du refresh token ;

- tests d’intégration de l’API ;

- tests garantissant l’isolation entre households ;

- tests d’archivage et restauration ;

- tests de validation.

Cas critique obligatoire :

Un utilisateur membre du household A ne doit jamais pouvoir lire, modifier ou supprimer un item du household B, même s’il connaît son identifiant.

### Mobile

Ajouter des tests pour :

- composants principaux ;

- formulaires ;

- validation ;

- état d’authentification ;

- rendu des listes ;

- gestion d’erreurs.

Ajouter quelques scénarios end-to-end si cela reste raisonnable.

Ne sacrifie pas la mise en place générale du projet pour une suite E2E mobile excessivement lourde.

## 16. Qualité du code

Activer le mode strict TypeScript.

Configurer :

- ESLint ;

- Prettier ;

- EditorConfig ;

- lint-staged ;

- Husky si cela reste simple ;

- tri cohérent des imports ;

- vérification TypeScript ;

- conventions de commits documentées.

Éviter :

- any non justifié ;

- logique métier dans les contrôleurs ;

- logique réseau dans les composants visuels ;

- duplications de DTO et types ;

- composants géants ;

- secrets dans Git ;

- catches silencieux ;

- erreurs ignorées ;

- dépendances inutiles.

Ajouter des commentaires uniquement quand ils expliquent une décision non évidente.

## 17. Documentation OpenAPI

Configurer Swagger pour l’API.

Inclure :

- schémas ;

- paramètres ;

- codes de réponse ;

- exemples ;

- sécurité Bearer ;

- erreurs standards.

Exposer la documentation en développement sur une route claire telle que :

```text
/api/docs
```

Permettre de désactiver cette documentation en production.

## 18. Format standard des erreurs

Créer un format cohérent :

```text
{
"statusCode": 400,
"code": "VALIDATION_ERROR",
"message": "Les données envoyées sont invalides.",
"details": [],
"requestId": "..."
}
```

Le mobile doit pouvoir mapper les erreurs de validation sur les champs concernés. Ne retourne pas les stack traces en production.

## 19. Observabilité

Prévoir :

- logs JSON en production ;

- logs lisibles en développement ;

- request ID ;

- endpoints de santé ;

- logs de démarrage ;

- erreurs non gérées ;

- intégration optionnelle Sentry pour API et mobile ;

- aucune donnée sensible dans les logs.

Documenter comment configurer un service de surveillance de disponibilité.

## 20. CI GitHub Actions

Créer une CI exécutée sur les pull requests et sur la branche principale.

Étapes minimales :

- installation avec lockfile ;

- lint ;

- vérification TypeScript ;

- tests ;

- build API ;

- validation du schéma Prisma ;

- détection des erreurs de formatage ;

- éventuellement build de vérification du mobile sans produire un binaire complet.

Utiliser un service PostgreSQL dans la CI pour les tests d’intégration. Ne déploie rien automatiquement tant que les secrets et environnements ne sont pas explicitement configurés.

## 21. Docker et production

Créer un Dockerfile multi-stage pour l’API.

Contraintes :

- image finale légère ;

- exécution avec un utilisateur non root ;

- uniquement les dépendances nécessaires ;

- healthcheck ;

- migrations de production documentées ;

- aucune clé dans l’image ;

- arrêt propre ;

- gestion des signaux.

Documenter deux stratégies de déploiement :

### Stratégie simple recommandée

- API sur Railway, Render, Fly.io ou équivalent ;

- PostgreSQL managé sur Neon, Supabase, Railway ou Prisma Postgres ;

- stockage sur Supabase Storage ou S3-compatible ;

- application mobile via EAS Build.

### Stratégie VPS

- VPS ;

- Docker Compose ;

- reverse proxy ;

- HTTPS ;

- PostgreSQL ou DB managée ;

- sauvegardes ;

- mises à jour ;

- monitoring.

Indique clairement que la DB managée est généralement préférable à PostgreSQL auto-hébergé pour un petit projet personnel nécessitant de la fiabilité.

## 22. Sauvegardes et restauration

Créer un document :

```text
docs/BACKUP_AND_RESTORE.md
```

Il doit expliquer :

- sauvegarde automatique de PostgreSQL ;

- rétention recommandée ;

- export manuel ;

- restauration sur une base de test ;

- test régulier des sauvegardes ;

- sauvegarde des images ;

- risques liés à la suppression d’un bucket ;

- procédure avant une migration risquée.

Prévoir un script optionnel de backup local utilisant `pg_dump`. Ne mets pas de credentials dans ce script.

## 23. Construction et installation mobile

Configurer Expo et EAS.

Créer :

- app.json ou app.config.ts ;

- identifiant Android ;

- bundle identifier iOS ;

- icône placeholder ;

- splash screen ;

- profils EAS development, preview et production ;

- configuration des variables d’environnement ;

- procédure de build Android ;

- procédure de build iOS ;

- procédure de distribution interne ;

- procédure de soumission aux stores.

Créer :

```text
docs/MOBILE_RELEASE.md
```

Ce document doit expliquer exactement :

1. créer un compte Expo ;

2. installer ou utiliser EAS CLI ;

3. se connecter ;

4. configurer le projet ;

5. renseigner les identifiants d’application ;

6. définir l’URL publique de l’API ;

7. produire un build de développement ;

8. produire un APK ou une distribution interne Android si possible ;

9. produire un AAB pour Google Play ;

10. produire un build iOS ;

11. gérer les certificats ;

12. soumettre aux stores ;

13. publier une mise à jour ;

14. vérifier la compatibilité entre version mobile et version API.

Ne prétends pas avoir généré ou publié un binaire si aucun compte ou credential réel n’est disponible.

## 24. README principal

Créer un README principal complet et directement exploitable.

Il doit comprendre :

### Présentation

- objectif ;

- captures ou emplacements de captures ;

- architecture ;

- fonctionnalités.

### Stack

- mobile ;

- API ;

- DB ;

- stockage ;

- tests ;

- CI.

### Pré-requis

- Node LTS ;

- pnpm ;

- Docker ;

- Expo Go ou émulateur ;

- outils nécessaires.

### Installation locale

Commandes exactes, dans le bon ordre.

### Variables d’environnement

Explication de chaque variable importante.

### Base de données

- migrations ;

- seed ;

- reset local ;

- Prisma Studio ;

- précautions.

### Lancement

- API ;

- mobile ;

- services Docker ;

- tests.

### Comptes de démonstration

Développement uniquement.

### Architecture du dépôt

Description des dossiers.

### Scripts disponibles

Tableau de toutes les commandes pnpm.

### Tests

Comment lancer chaque niveau de test.

### Déploiement

Résumé et liens vers les documents détaillés.

### Génération mobile

Résumé et lien vers `docs/MOBILE_RELEASE.md`.

### Sécurité

Résumé des choix.

### Sauvegardes

Résumé et lien.

### Limitations connues

Liste honnête.

### Roadmap

Fonctionnalités futures possibles.

## 25. Autres documents obligatoires

Créer au minimum :

README.md CONTRIBUTING.md SECURITY.md CHANGELOG.md

```text
docs/ARCHITECTURE.md
docs/API.md
docs/DEPLOYMENT.md
docs/MOBILE_RELEASE.md
docs/BACKUP_AND_RESTORE.md
docs/OPERATIONS.md
docs/ROADMAP.md
docs/DECISIONS.md
```

### ARCHITECTURE.md

Inclure :

- vue globale ;

- frontières des modules ;

- flux d’authentification ;

- modèle household/item owners ;

- gestion des images ;

- dépendances ;

- diagrammes Mermaid.

### DECISIONS.md

Documenter les décisions importantes :

- pourquoi PostgreSQL ;

- pourquoi NestJS ;

- pourquoi Expo ;

- pourquoi REST ;

- pourquoi relation ItemOwner ;

- pourquoi suppression logique ;

- pourquoi pas de microservices ;

- pourquoi pas d’Elasticsearch ;

- stratégie de métadonnées.

### OPERATIONS.md

Inclure :

- vérifier la santé ;

- consulter les logs ;

- redémarrer l’API ;

- déployer une migration ;

- revenir en arrière ;

- changer un secret ;

- restaurer une DB ;

- gérer un incident ;

- vérifier le stockage ;

- révoquer des sessions.

## 26. Configuration et instructions permanentes pour Claude Code

Créer également les fichiers suivants :

CLAUDE.md

```text
docs/NOTRE_NID_PRD.md
docs/IMPLEMENTATION_PLAN.md
docs/PHASE_STATUS.md
```

Le fichier CLAUDE.md constitue l’entrée principale de Claude Code pour ce dépôt. Il doit rester court, opérationnel et stable. Il ne doit pas recopier tout le PRD. Il doit importer le cahier des charges Markdown avec la syntaxe suivante :

@docs/NOTRE_NID_PRD.md

CLAUDE.md doit résumer les conventions permanentes du dépôt :

- TypeScript strict ;

- architecture du monorepo et frontières entre applications et packages ;

- commandes exactes d’installation, de développement, de lint, de typecheck, de test, de migration et de build ;

- règles de sécurité ;

- isolation stricte des households ;

- validation obligatoire des appartenances et permissions côté serveur ;

- migrations obligatoires pour toute évolution du schéma ;

- documentation à maintenir en même temps que le code ;

- interdiction de commiter des secrets ;

- interdiction d’ignorer silencieusement une erreur, un test ou une vérification TypeScript ;

- interdiction de modifier de manière cassante le contrat API sans migration, versionnement et documentation ;

- tests obligatoires pour toute modification des permissions, de l’authentification ou de l’isolation des données ;

- interdiction de déclarer une fonctionnalité terminée si elle n’a pas été exécutée ou vérifiée ;

- interdiction de pousser, déployer en production, réécrire l’historique Git ou exécuter une opération destructive sans demande explicite du propriétaire.

Le fichier docs/NOTRE_NID_PRD.md doit contenir une version Markdown complète et lisible du présent cahier des charges. Il constitue la source de vérité fonctionnelle et technique consultable directement par Claude Code.

Le fichier docs/IMPLEMENTATION_PLAN.md doit contenir :

- l’ordre des phases ;

- les dépendances entre travaux ;

- les critères de sortie de chaque phase ;

- les commandes de validation ;

- les opérations nécessitant un compte externe ou une intervention humaine.

Le fichier docs/PHASE_STATUS.md doit être mis à jour à la fin de chaque phase et contenir :

- la phase courante ;

- les éléments terminés ;

- les fichiers principaux créés ou modifiés ;

- les migrations ajoutées ;

- les commandes réellement exécutées et leur résultat ;

- les problèmes connus ;

- les décisions prises ;

- les actions manuelles restantes ;

- la prochaine étape recommandée.

Une configuration partagée dans .claude/settings.json peut être créée si elle apporte une valeur réelle. Elle doit respecter le principe du moindre privilège. Elle ne doit jamais désactiver globalement les confirmations, autoriser des commandes destructives de façon générale ou contenir des secrets.

Claude Code doit utiliser les instructions du dépôt comme des contraintes durables, mais toujours confronter ces instructions à l’état réel du code. Si le PRD, CLAUDE.md et le dépôt se contredisent, signaler précisément la contradiction, privilégier la sécurité et mettre la documentation à jour après décision.

### Démarrage recommandé

Pour la première session, lancer Claude Code à la racine du dépôt en mode de planification :

```text
claude --permission-mode plan
```

Puis lui transmettre une instruction courte :

Lis intégralement CLAUDE.md et docs/NOTRE_NID_PRD.md. Inspecte le dépôt et confronte son état réel au cahier des charges. Travaille uniquement sur la phase explicitement demandée. Commence par présenter ton plan, puis implémente, valide toutes les commandes et mets à jour docs/PHASE_STATUS.md avant de t’arrêter.

Pour reprendre la session la plus récente dans ce dépôt :

```text
claude --continue
```

Pour reprendre une session déterminée :

```text
claude --resume <session-id>
```

N’utilise jamais une option supprimant globalement les confirmations de permission.

## 27. Roadmap future

Documenter sans forcément implémenter maintenant :

- scan ISBN ;

- récupération automatique des métadonnées ;

- scan de codes-barres ;

- wishlist ;

- prêts ;

- emprunts ;

- tags ;

- collections multiples ;

- historique complet ;

- notifications ;

- application web ;

- mode offline-first ;

- détection de doublons ;

- import CSV ;

- statistiques avancées ;

- partage en lecture seule ;

- authentification sociale ;

- passkeys.

Ne laisse pas ces fonctionnalités incomplètes dans la première version derrière des boutons qui ne fonctionnent pas.

## 28. Méthode de travail obligatoire

Avant de coder :

1. inspecte le dépôt ;

2. crée un plan détaillé ;

3. liste les décisions techniques ;

4. identifie les opérations qui nécessiteront une intervention humaine ;

5. crée les dossiers et fichiers de base ;

6. implémente par incréments cohérents.

Travaille dans cet ordre :

### Phase 1 — Fondation

- monorepo ;

- configuration TypeScript ;

- lint et format ;

- Docker ;

- PostgreSQL ;

- API NestJS ;

- Prisma ;

- mobile Expo ;

- packages partagés.

### Phase 2 — Backend métier

- modèles ;

- migrations ;

- seed ;

- auth ;

- households ;

- membres ;

- invitations ;

- catégories ;

- items ;

- propriétaires ;

- recherche ;

- uploads ;

- statistiques ;

- exports.

### Phase 3 — Mobile

- thème ;

- navigation ;

- auth ;

- household ;

- accueil ;

- collection ;

- filtres ;

- détail ;

- ajout ;

- édition ;

- profil ;

- archives ;

- gestion d’erreurs.

### Phase 4 — Qualité

- tests ;

- OpenAPI ;

- client typé ;

- CI ;

- sécurité ;

- logs ;

- healthchecks.

### Phase 5 — Livraison

- Docker production ;

- EAS ;

- documentation ;

- checklist ;

- vérifications finales.

Après chaque phase :

- exécute le lint ;

- exécute la vérification TypeScript ;

- exécute les tests concernés ;

- corrige les erreurs avant de poursuivre ;

- mets à jour la documentation.

Ne déclare pas une phase terminée si les commandes échouent.

## 29. Vérifications finales obligatoires

À la fin, vérifier réellement :

- installation depuis un clone propre ;

- lancement de PostgreSQL ;

- application des migrations ;

- exécution du seed ;

- démarrage de l’API ;

- endpoint de santé ;

- documentation Swagger ;

- inscription ;

- connexion ;

- refresh token ;

- création d’un household ;

- ajout du second membre ;

- création des trois types d’items ;

- item appartenant à un utilisateur ;

- item appartenant aux deux ;

- recherche ;

- filtres ;

- modification ;

- archivage ;

- restauration ;

- export ;

- isolation entre households ;

- lancement Expo ;

- connexion du mobile à l’API ;

- affichage de la collection ;

- ajout depuis le mobile ;

- tests ;

- lint ;

- build API ;

- CI valide.

Lorsque quelque chose ne peut pas être vérifié sans compte externe, inscris-le explicitement dans la checklist finale.

## 30. Checklist manuelle finale

Créer un fichier :

```text
docs/GO_LIVE_CHECKLIST.md
```

Il doit distinguer clairement :

### Déjà automatisé dans le dépôt

Exemples :

- code ;

- migrations ;

- Docker ;

- tests ;

- configuration EAS ;

- documentation.

### À faire manuellement par le propriétaire

Exemples :

- acheter ou choisir un nom de domaine ;

- créer la DB managée ;

- créer le service d’hébergement API ;

- créer le bucket ;

- créer les secrets ;

- créer le compte Expo ;

- choisir les identifiants Android/iOS ;

- créer les comptes Google Play et Apple Developer si publication ;

- configurer les sauvegardes ;

- configurer les alertes ;

- exécuter la première migration ;

- créer le premier build ;

- tester sur deux téléphones ;

- vérifier les restaurations ;

- accepter les coûts des services choisis.

Pour chaque opération manuelle, fournir :

- l’objectif ;

- les valeurs nécessaires ;

- où les renseigner ;

- la commande à exécuter ;

- comment vérifier que cela fonctionne ;

- les erreurs fréquentes.

## 31. Définition de “terminé”

Le travail est considéré comme terminé uniquement si :

- le dépôt contient du code fonctionnel, pas uniquement une documentation ;

- l’environnement local est reproductible ;

- l’API démarre ;

- la DB se migre ;

- le seed fonctionne ;

- l’application mobile démarre ;

- les principaux parcours sont implémentés ;

- les règles d’accès sont testées ;

- le README permet à un développeur de lancer le projet ;

- le guide de déploiement permet de le rendre accessible en ligne ;

- le guide mobile permet de générer une version installable ;

- les tâches nécessitant des comptes externes sont clairement signalées ;

- aucun secret réel n’est commité ;

- aucune fonctionnalité factice n’est présentée comme terminée.

## 32. Contraintes d’exécution dans Claude Code

Ne me donne pas uniquement une longue explication théorique.

Au début d’une nouvelle session de travail :

1. lis intégralement CLAUDE.md et les fichiers qu’il importe ;

2. inspecte le dépôt, son arborescence, le statut Git, les dépendances et la documentation existante ;

3. confronte l’état réel du dépôt au cahier des charges ;

4. résume l’architecture comprise ;

5. indique la phase visée, les risques, les hypothèses et les opérations manuelles éventuelles ;

6. présente un plan d’implémentation concret avant les modifications importantes.

Lorsque Claude Code est lancé avec le mode de permission plan, utilise cette étape pour analyser et planifier sans modifier le dépôt. Une fois l’implémentation autorisée, réalise réellement les changements prévus au lieu de produire uniquement des extraits ou des pseudo-fichiers.

Pendant l’implémentation :

- travaille phase par phase et évite de commencer la phase suivante avant validation de la phase courante ;

- lis les fichiers concernés avant de les modifier ;

- privilégie des changements cohérents et vérifiables ;

- exécute les générateurs, migrations et commandes réelles lorsque cela est nécessaire ;

- ne masque pas les erreurs avec des contournements fragiles ;

- ne supprime pas des tests pour obtenir artificiellement une CI verte ;

- n’utilise pas any, des mocks permanents ou des valeurs codées en dur pour contourner une conception incomplète ;

- ne modifie pas une migration déjà appliquée : crée une nouvelle migration ;

- ne lance pas de déploiement, de migration de production, de suppression de données, de réécriture Git ou de push sans demande explicite ;

- n’utilise pas un mode supprimant toutes les confirmations de sécurité ;

- ne commite et ne pousse rien sauf demande explicite ;

- conserve les changements dans un état lisible et révisable par un développeur humain.

Après chaque phase :

1. exécute le lint ;

2. exécute la vérification TypeScript ;

3. exécute les tests unitaires et d’intégration concernés ;

4. exécute les builds concernés ;

5. vérifie les migrations et le schéma Prisma ;

6. corrige les erreurs avant de conclure ;

7. mets à jour README.md, CLAUDE.md si nécessaire, docs/IMPLEMENTATION_PLAN.md et docs/PHASE_STATUS.md ;

8. fournis un rapport factuel et arrête-toi si la session était limitée à une phase.

Le rapport final doit inclure :

- ce qui a été créé ou modifié ;

- ce qui fonctionne réellement ;

- les commandes exécutées et leurs résultats ;

- les tests ajoutés ;

- les migrations ajoutées ;

- les vérifications non réalisables sans compte ou service externe ;

- les limites et dettes techniques restantes ;

- les actions manuelles restantes ;

- le chemin exact vers docs/GO_LIVE_CHECKLIST.md ;

- le chemin exact vers docs/PHASE_STATUS.md.

Prends des décisions raisonnables sans me bloquer sur des questions secondaires. Si un choix nécessite réellement mon intervention, utilise une valeur placeholder documentée et poursuis tout le travail indépendant de ce choix.

Ne mets jamais de fausse clé, de faux certificat ou de secret ressemblant à un vrai secret dans le dépôt.

Le projet doit pouvoir être repris dans une session ultérieure avec les fichiers de documentation et l’état Git comme sources de continuité. Ne dépends pas uniquement de l’historique de conversation de Claude Code.

Construis maintenant l’application complète en respectant ce cahier des charges, en commençant par la phase explicitement demandée par le propriétaire du dépôt.

Instruction finale à Claude Code : Lis d’abord CLAUDE.md et la version Markdown du PRD, inspecte le dépôt, puis construis l’application phase par phase. Vérifie chaque commande et ne déclare jamais une fonctionnalité terminée sans preuve d’exécution ou sans signaler explicitement la vérification manuelle restante.
