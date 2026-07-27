# Notre Nid — Mobile

Application mobile Expo (Expo Router, TypeScript strict). Fait partie du monorepo `notre-nid` : voir le [README principal](../../README.md) pour l'installation complète.

## Statut (Phase 1 — Fondation)

Squelette Expo Router fonctionnel avec un unique écran de bienvenue. Le système de thème, la navigation à cinq destinations et les écrans métier (collection, ajout, profil, ...) seront construits en Phase 3, conformément à `docs/NOTRE_NID_PRD.md`.

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
