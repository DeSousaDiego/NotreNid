# Fixtures TMDB — test-only, mode A (CI, sans réseau)

Réponses `search`/`getDetails` réalistes, reconstruites à partir des appels
réels documentés dans `docs/DECISIONS.md` (Bloc 3D — "preuves réelles" n°1 à
3). Utilisées pour mocker `TmdbProvider.search`/`getDetails` dans
`dvd-pipeline.integration.spec.ts` : le VRAI `DvdEnrichmentService` (nettoyage
de titre, extraction d'année, scoring, sélection déterministe) s'exécute sur
ces réponses, seul l'appel HTTP est remplacé.

Jamais importées par le code runtime de production. Pour un test manuel avec
TMDB réel (nécessite `TMDB_READ_ACCESS_TOKEN`), voir
`apps/api/scripts/dvd-manual-tmdb-check.ts`, qui n'utilise PAS ces fixtures
TMDB (seulement une fixture UPCitemdb) et appelle réellement `api.themoviedb.org`.
