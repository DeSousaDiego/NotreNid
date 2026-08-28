# Génération et distribution de l'application mobile — Notre Nid

Guide pas à pas pour produire une version installable de l'application mobile (`apps/mobile`) via EAS (Expo Application Services). **Aucun build réel n'a été produit par Claude Code** : aucun compte Expo, identifiant Apple/Google ni credential de signature n'existe dans cet environnement — chaque étape ci-dessous est une action manuelle du propriétaire du dépôt. Voir `docs/GO_LIVE_CHECKLIST.md` pour la vue d'ensemble avec le reste de la mise en production.

Ce qui est déjà prêt dans le dépôt : `apps/mobile/app.json` (identifiants d'application, icônes, splash screen — voir ci-dessous) et `apps/mobile/eas.json` (profils `development`/`preview`/`production`).

## 1. Créer un compte Expo

Sur [expo.dev](https://expo.dev), créer un compte (gratuit pour ce volume d'usage). Noter le nom d'utilisateur/organisation — il sera utilisé à l'étape 4.

## 2. Installer ou utiliser EAS CLI

```bash
# Pas d'installation globale requise — npx utilise toujours la dernière version stable :
npx eas-cli --version
```

## 3. Se connecter

```bash
npx eas-cli login
```

## 4. Configurer le projet

Depuis `apps/mobile/` :

```bash
cd apps/mobile
npx eas-cli init
```

Cette commande crée le projet côté Expo et **écrit automatiquement** `extra.eas.projectId` dans `apps/mobile/app.json` — ne jamais renseigner cette valeur manuellement ni en fabriquer une factice.

## 5. Renseigner les identifiants d'application

Déjà présents dans `apps/mobile/app.json` :

- iOS `bundleIdentifier` : `com.notrenid.app`
- Android `package` : `com.notrenid.app`

**À vérifier avant le premier build de production** : ces identifiants doivent être uniques sur les stores respectifs. S'ils sont déjà pris (peu probable pour ce nom précis, mais à vérifier), les modifier de façon cohérente dans `app.json` avant `eas init` — un changement après coup nécessite de reconfigurer les credentials de signature.

## 6. Définir l'URL publique de l'API

Chaque profil de `apps/mobile/eas.json` définit sa propre `EXPO_PUBLIC_API_URL` (variable publique, embarquée telle quelle dans le bundle — ne doit jamais contenir de secret) :

| Profil | Usage | Valeur à renseigner |
| --- | --- | --- |
| `development` | Build de développement (dev client), testé sur un appareil du même réseau local | IP locale de la machine faisant tourner l'API (déjà en placeholder : `http://192.168.1.31:3000/api/v1` — à ajuster à votre réseau) |
| `preview` | Distribution interne (testeurs), pointe vers un environnement de staging | Remplacer `https://REMPLACER-PAR-URL-API-STAGING.example.com/api/v1` par l'URL réelle une fois l'API de staging déployée (`docs/DEPLOYMENT.md`) |
| `production` | Soumission aux stores | Remplacer `https://REMPLACER-PAR-URL-API-PRODUCTION.example.com/api/v1` par l'URL HTTPS réelle de l'API de production |

Modifier ces valeurs directement dans `apps/mobile/eas.json` avant de lancer un build `preview` ou `production` — un build avec une URL placeholder ne pourra jamais joindre d'API réelle.

## 7. Produire un build de développement

```bash
cd apps/mobile
npx eas-cli build --profile development --platform android
# ou --platform ios (nécessite un compte Apple Developer pour le provisioning, voir étape 11)
```

Installe un client de développement (dev client) sur un appareil physique ou un simulateur/émulateur, permettant de recharger le JS via `pnpm dev:mobile` sans reconstruire le binaire natif à chaque changement.

## 8. Produire un APK / une distribution interne Android

```bash
npx eas-cli build --profile preview --platform android
```

Le profil `preview` (`buildType: apk`) produit un fichier `.apk` installable directement (transféré par lien, email, ou QR code fourni par EAS) — sans passer par le Play Store, adapté aux tests entre les deux membres du couple avant publication.

## 9. Produire un AAB pour Google Play

```bash
npx eas-cli build --profile production --platform android
```

Le profil `production` (`buildType: app-bundle`) produit un `.aab`, format requis par Google Play (pas installable directement — uniquement soumissible via la Play Console, voir étape 12).

## 10. Produire un build iOS

```bash
npx eas-cli build --profile production --platform ios
```

Nécessite un compte Apple Developer actif (99 $/an, voir étape 11) pour la signature — EAS gère la génération et le renouvellement des certificats/profils si on le laisse faire (recommandé, voir étape suivante).

## 11. Gérer les certificats

```bash
npx eas-cli credentials
```

Recommandation : **laisser EAS gérer les certificats et profils de provisioning automatiquement** (option par défaut lors du premier build) plutôt que de les générer manuellement via le portail Apple Developer — évite les erreurs de configuration les plus fréquentes (profil expiré, certificat ne correspondant pas au bundle identifier).

## 12. Soumettre aux stores

```bash
npx eas-cli submit --platform android --profile production   # Google Play
npx eas-cli submit --platform ios --profile production        # App Store
```

Prérequis :

- **Google Play** : compte Google Play Console (25 $, paiement unique), fiche du store remplie (description, captures d'écran, politique de confidentialité — obligatoire même pour une app non commerciale collectant un email), premier AAB envoyé manuellement une première fois via la console avant que `eas submit` puisse automatiser les envois suivants.
- **App Store** : compte Apple Developer actif, fiche App Store Connect remplie, révision Apple (délai variable, généralement 24 à 48 h).

## 13. Publier une mise à jour

`expo-updates` est installé et configuré (`apps/mobile/app.json` : `updates.url`, `runtimeVersion.policy: "appVersion"` ; `apps/mobile/eas.json` : un canal EAS Update par profil de build — `development`/`preview`/`production`). Permet de pousser une mise à jour JS/assets sans repasser par la validation des stores, **à condition** de ne modifier que du code JavaScript (voir limite ci-dessous).

```bash
cd apps/mobile
npx eas-cli update --channel preview --message "Description du changement"
# ou --channel production pour pousser vers les utilisateurs de la version store
```

- Les appareils déjà installés téléchargent la mise à jour au prochain lancement de l'app (comportement par défaut d'`expo-updates`), sans passer par le Play Store/App Store.
- **`runtimeVersion.policy: "appVersion"`** : une mise à jour publiée sur un canal n'est proposée qu'aux installations dont `apps/mobile/app.json` `version` correspond exactement à la version du build. Après tout changement de code **natif** (nouveau module natif, changement de plugin de configuration, changement de `version`) : produire un **nouveau build complet** (étapes 9-10) — `eas update` ne peut jamais remplacer un changement natif, uniquement le bundle JS/les assets.
- Vérifier qu'une mise à jour a bien été reçue : `npx eas-cli update:list --channel <canal>` ; sur l'appareil, forcer une nouvelle vérification en relançant complètement l'app (pas juste revenir au premier plan).

## 14. Vérifier la compatibilité entre version mobile et version API

- `apps/mobile/app.json` (`version`) et `apps/api/package.json` (`version`) évoluent indépendamment — aucun mécanisme de blocage automatique ne les lie dans cette V1 (l'API expose `/health` mais pas de numéro de version dans sa réponse).
- Avant de publier une mise à jour mobile qui suppose un changement d'API (nouveau champ, nouvelle route) : déployer et vérifier l'API en production **avant** de soumettre le build mobile correspondant — le contrat versionné (`/api/v1`, voir `docs/API.md`) protège les anciennes versions du mobile déjà installées contre une rupture, mais une nouvelle fonctionnalité mobile qui dépend d'une route encore absente en production échouera silencieusement pour les premiers utilisateurs de la mise à jour.
- Recommandation pour ce projet à deux utilisateurs : mettre à jour l'API puis le mobile, jamais l'inverse.

## Récapitulatif — ce qui est prêt vs manuel

| Élément | Statut |
| --- | --- |
| `apps/mobile/app.json` (identifiants, icônes, splash) | ✅ prêt dans le dépôt |
| `apps/mobile/eas.json` (profils development/preview/production) | ✅ prêt dans le dépôt (URLs `preview`/`production` à remplacer, voir étape 6) |
| `expo-updates` (mises à jour OTA, un canal par profil) | ✅ prêt dans le dépôt — voir étape 13 |
| Compte Expo, `eas init` (`projectId`) | ⏳ manuel — étapes 1-4 |
| Compte Apple Developer / Google Play Console | ⏳ manuel — étape 12 |
| Premier build (tout profil) | ⏳ manuel — nécessite les étapes précédentes |
| Vérification visuelle sur appareil réel | ⏳ manuel — voir `docs/PHASE_STATUS.md` (limitation d'environnement documentée depuis la Phase 3A) |
