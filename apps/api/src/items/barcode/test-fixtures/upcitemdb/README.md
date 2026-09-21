# Fixtures UPCitemdb — test-only

Ce dossier contient des fixtures **exclusivement destinées aux tests backend**
(`*.spec.ts`, `rootDir: 'src'` dans `apps/api/jest.config.js`). **Aucun fichier
de ce dossier ne doit jamais être importé par le code runtime de production**
(`barcode.module.ts`, les resolvers, les providers) — il n'existe aucun "mode
fixture" activable en production, conformément à la décision explicite du
propriétaire.

## Provenance

Les barcodes utilisés (`065935831686`, `883929308002`, `786936815481`,
`792266015255`, `016000487727`) sont ceux réellement interrogés contre l'API
UPCitemdb pendant le POC (voir `docs/DECISIONS.md`, Bloc 3C). Les corps JSON
bruts de ces appels n'ont pas été persistés en fichier au moment du POC (seule
la session Claude Code les a inspectés en direct) : les fixtures ci-dessous
sont des **reconstructions fidèles** à partir des observations documentées
dans `docs/DECISIONS.md` (titre exact, `category`, indices d'édition/
packaging) — jamais un champ inventé ou supposé. Chaque fixture renvoie vers
le paragraphe correspondant de `docs/DECISIONS.md` dans son commentaire d'en-
tête.

## Format

Chaque fixture (`*.fixture.ts`) exporte une constante `RawUpcItemDbResponseFixture`
— la même enveloppe qu'une vraie réponse `GET
https://api.upcitemdb.com/prod/trial/lookup?upc={code}` (`{ code, total,
offset, items }`) — plus la constante du barcode associé.

`parseUpcItemDbFixture(fixture, barcode)` traduit cette fixture brute en
`UpcItemDbLookupOutcome`, exactement comme le ferait `UpcItemDbProvider` en
production, en réutilisant ses fonctions de classification **réellement
exportées** (`detectMediaType`, `detectEditionHint`, `detectRegionHint`,
`detectPackagingHint`, `selectMatchingItem`) — c'est cette logique réelle qui
est exercée par les tests, jamais une réimplémentation indépendante.

## Usage

```ts
import { UpcItemDbProvider } from '../../providers/upcitemdb.provider';
import { NINE_BLURAY_BARCODE, NINE_BLURAY_FIXTURE, parseUpcItemDbFixture } from '../test-fixtures/upcitemdb';

const fakeUpcItemDb = {
  id: 'upcitemdb',
  lookup: jest.fn().mockResolvedValue(parseUpcItemDbFixture(NINE_BLURAY_FIXTURE, NINE_BLURAY_BARCODE)),
} as unknown as UpcItemDbProvider;
```

Voir `apps/api/src/items/barcode/dvd-pipeline.integration.spec.ts` pour
l'utilisation complète (pipeline réel `DvdBarcodeResolverService` +
`DvdEnrichmentService`, TMDB mocké).
