# Notre Nid — Mobile

Application mobile Expo (Expo Router, TypeScript strict). Fait partie du monorepo `notre-nid` : voir le [README principal](../../README.md) pour l'installation complète.

## Statut

Application complète (phases 1 à 5 terminées — voir `docs/PHASE_STATUS.md`) : thème « Notre Nid », navigation à cinq destinations (Accueil/Collection/Ajouter/Recherche/Profil), authentification, tous les écrans métier (collection, détail, ajout/modification, membres, invitations, catégories, archives, exports).

Génération d'un build installable (Android/iOS) : voir [docs/MOBILE_RELEASE.md](../../docs/MOBILE_RELEASE.md). Configuration EAS : [eas.json](eas.json).

## Commandes

Depuis la racine du monorepo :

```bash
pnpm --filter @notre-nid/mobile start   # démarre Metro / Expo Dev Tools
pnpm --filter @notre-nid/mobile android
pnpm --filter @notre-nid/mobile ios
pnpm --filter @notre-nid/mobile web
pnpm --filter @notre-nid/mobile lint
pnpm --filter @notre-nid/mobile typecheck
```

Ouvrir ensuite l'app avec Expo Go, un simulateur iOS ou un émulateur Android.
