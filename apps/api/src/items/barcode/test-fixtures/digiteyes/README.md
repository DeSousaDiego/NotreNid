# Fixtures Digit-Eyes — test-only

Fixtures **exclusivement destinées aux tests backend**. Aucun fichier de ce
dossier ne doit être importé par le code runtime : il n'existe aucun « mode
fixture » en production.

## Provenance

Réponses réelles de `GET https://www.digit-eyes.com/gtin/v2_0/` avec
`field_names=all,categories` (`language=en`), capturées lors du POC du
2026-10-06 sur les 5 barcodes de référence du pipeline `dvd` (mêmes codes que
`../upcitemdb/`). Voir `docs/DECISIONS.md`, « Digit-Eyes ».

- Seuls les champs utiles au pipeline sont conservés (`upc_code`,
  `return_code`, `description`, `brand`, `categories`, `image`, `usage`,
  `uom`, `manufacturer.company`) ; les valeurs sont celles observées, jamais
  inventées. Seul `usage` de Cheerios est tronqué.
- Les blocs volatils ou sans intérêt pour le pipeline (`gcp`,
  `product_web_page`, `website`, `nutrition`…) sont omis.
- **Aucun secret** : `app_key` et la signature ne figurent que dans l'URL de
  requête, jamais dans le corps de réponse ; aucune URL de requête n'est
  stockée ici.

## Usage

`normalizeDigitEyesProduct(fixture.response, fixture.barcode)` exerce la
vraie normalisation/classification du provider, sans réseau ni quota. Aucun
test ne doit appeler la vraie API Digit-Eyes (chaque requête est facturée).
