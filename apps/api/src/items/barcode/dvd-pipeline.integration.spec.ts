import { BarcodeCacheService } from './barcode-cache.service';
import { DvdBarcodeResolverService } from './dvd-barcode-resolver.service';
import { DvdEnrichmentService } from './dvd-enrichment.service';
import type { TmdbProvider } from './providers/tmdb.provider';
import type { UpcItemDbProvider } from './providers/upcitemdb.provider';
import {
  AVATAR_TMDB_DETAILS,
  AVATAR_TMDB_SEARCH_RESULTS,
  DARK_KNIGHT_TRILOGY_TMDB_SEARCH_RESULTS,
  NINE_TMDB_DETAILS,
  NINE_TMDB_SEARCH_RESULTS,
  PIRATES_TMDB_DETAILS,
  PIRATES_TMDB_SEARCH_RESULTS,
} from './test-fixtures/tmdb';
import {
  AVATAR_BARCODE,
  AVATAR_FIXTURE,
  CHEERIOS_BARCODE,
  CHEERIOS_FIXTURE,
  DARK_KNIGHT_TRILOGY_BARCODE,
  DARK_KNIGHT_TRILOGY_FIXTURE,
  NINE_BLURAY_BARCODE,
  NINE_BLURAY_FIXTURE,
  parseUpcItemDbFixture,
  PIRATES_BARCODE,
  PIRATES_FIXTURE,
} from './test-fixtures/upcitemdb';

/**
 * Test d'intégration du pipeline `dvd` complet — VRAI `DvdBarcodeResolverService`,
 * VRAI `DvdEnrichmentService` (donc vrai nettoyage de titre, vraie extraction
 * d'année, vrai scoring/seuil de confiance, vrai mapping champ par champ) et
 * VRAIE `BarcodeCacheService`. Seuls les DEUX appels réseau sont remplacés :
 * `UpcItemDbProvider.lookup` (par une fixture réellement capturée pendant le
 * POC, voir `test-fixtures/upcitemdb/README.md`) et `TmdbProvider.search`/
 * `getDetails` (par des réponses réalistes reconstruites à partir des appels
 * réels documentés, voir `test-fixtures/tmdb/README.md`). Zéro appel réseau
 * réel, zéro secret nécessaire — objectif explicite : valider tout le
 * pipeline sans jamais consommer le quota UPCitemdb (100/jour).
 *
 * Pour un test manuel avec TMDB réellement interrogé (jamais en CI), voir
 * `apps/api/scripts/dvd-manual-tmdb-check.ts`.
 */
function fakeUpcItemDb(lookup: jest.Mock): UpcItemDbProvider {
  return { id: 'upcitemdb', lookup } as unknown as UpcItemDbProvider;
}

function fakeTmdb(search: jest.Mock, getDetails: jest.Mock): TmdbProvider {
  return { id: 'tmdb', search, getDetails } as unknown as TmdbProvider;
}

function buildResolver(upcLookup: jest.Mock, tmdbSearch: jest.Mock, tmdbGetDetails: jest.Mock) {
  const enrichment = new DvdEnrichmentService(fakeTmdb(tmdbSearch, tmdbGetDetails));
  return new DvdBarcodeResolverService(
    fakeUpcItemDb(upcLookup),
    enrichment,
    new BarcodeCacheService(),
  );
}

describe('dvd pipeline (integration, no network)', () => {
  it('scenario "9" Blu-ray: matched, full TMDB enrichment, cover UPC prioritaire', async () => {
    const upcLookup = jest
      .fn()
      .mockResolvedValue(parseUpcItemDbFixture(NINE_BLURAY_FIXTURE, NINE_BLURAY_BARCODE));
    const tmdbSearch = jest.fn().mockResolvedValue(NINE_TMDB_SEARCH_RESULTS);
    const tmdbGetDetails = jest.fn().mockResolvedValue(NINE_TMDB_DETAILS);
    const resolver = buildResolver(upcLookup, tmdbSearch, tmdbGetDetails);

    const response = await resolver.resolve(NINE_BLURAY_BARCODE);

    // Vrai nettoyage de titre + vraie extraction d'année, exercés pour de
    // vrai sur la fixture ("9 (Blu-ray Disc, 2009)" → "9", année 2009).
    expect(tmdbSearch).toHaveBeenCalledWith('9', 2009);
    expect(tmdbGetDetails).toHaveBeenCalledWith(12244);

    expect(response.status).toBe('matched');
    expect(response.match).toBe(true);
    expect(response.source).toBe('upcitemdb');
    expect(response.data?.title).toBe('9');
    expect(response.data?.dvd).toEqual({
      director: 'Shane Acker',
      releaseYear: 2009,
      duration: 79,
      edition: null,
      region: null,
      format: null,
    });
    expect(response.data?.countryCodes).toEqual(['US']);
    // Priorité à l'image UPC, jamais au poster TMDB, quand elle est présente.
    expect(response.cover?.url).toBe(
      'https://example-fixture.test/upcitemdb/nine-bluray-cover.jpg',
    );
    expect(response.cover?.url).not.toBe(NINE_TMDB_DETAILS.posterUrl);
  });

  it('scenario Dark Knight Trilogy (coffret) : TMDB ne force aucun film unique, partial avec uniquement les champs UPC sûrs', async () => {
    const upcLookup = jest
      .fn()
      .mockResolvedValue(
        parseUpcItemDbFixture(DARK_KNIGHT_TRILOGY_FIXTURE, DARK_KNIGHT_TRILOGY_BARCODE),
      );
    const tmdbSearch = jest.fn().mockResolvedValue(DARK_KNIGHT_TRILOGY_TMDB_SEARCH_RESULTS);
    const tmdbGetDetails = jest.fn();
    const resolver = buildResolver(upcLookup, tmdbSearch, tmdbGetDetails);

    const response = await resolver.resolve(DARK_KNIGHT_TRILOGY_BARCODE);

    expect(tmdbSearch).toHaveBeenCalledWith('The Dark Knight Trilogy', null);
    // Aucun film ne doit jamais être forcé sur un coffret — le seul résultat
    // réel (un documentaire) est écarté par le scoring, `getDetails` n'est
    // donc jamais appelé.
    expect(tmdbGetDetails).not.toHaveBeenCalled();

    expect(response.status).toBe('partial');
    expect(response.match).toBe(false);
    // Titre UPC nettoyé, jamais brut, jamais un titre TMDB fabriqué.
    expect(response.data?.title).toBe('The Dark Knight Trilogy');
    // Aucun champ TMDB inventé.
    expect(response.data?.dvd).toEqual({
      director: null,
      releaseYear: null,
      duration: null,
      edition: null,
      region: null,
      // Seul champ UPC sûr détecté ici : "6-Disc" (indice élargi à
      // `offers[].title`, jamais présent dans le `title` principal, voir la
      // fixture) — jamais un champ TMDB.
      format: '6-Disc',
    });
    expect(response.data?.countryCodes).toBeNull();
    expect(response.cover?.url).toBe(
      'https://example-fixture.test/upcitemdb/dark-knight-trilogy-cover.jpg',
    );
  });

  it('scenario Pirates combo DVD/Blu-ray : classification vidéo correcte, matching exact, données UPC et TMDB séparées', async () => {
    const upcOutcome = parseUpcItemDbFixture(PIRATES_FIXTURE, PIRATES_BARCODE);
    // `mediaType` interne reste 'dvd' (mot-clé "DVD" présent, jamais déduit
    // de `category`) — jamais exposé publiquement, mais vérifié ici comme
    // preuve que la classification réelle a bien eu lieu sur cette fixture.
    expect(upcOutcome.status).toBe('matched');
    expect(upcOutcome.status === 'matched' && upcOutcome.result.mediaType).toBe('dvd');

    const upcLookup = jest.fn().mockResolvedValue(upcOutcome);
    const tmdbSearch = jest.fn().mockResolvedValue(PIRATES_TMDB_SEARCH_RESULTS);
    const tmdbGetDetails = jest.fn().mockResolvedValue(PIRATES_TMDB_DETAILS);
    const resolver = buildResolver(upcLookup, tmdbSearch, tmdbGetDetails);

    const response = await resolver.resolve(PIRATES_BARCODE);

    expect(tmdbSearch).toHaveBeenCalledWith("Pirates of the Caribbean: At World's End", null);
    expect(tmdbGetDetails).toHaveBeenCalledWith(285);

    expect(response.status).toBe('matched');
    expect(response.data?.book).toBeNull();
    expect(response.data?.cd).toBeNull();
    // Données physiques (UPC) et filmographiques (TMDB) jamais mélangées :
    // edition/region/format viennent exclusivement d'UPCitemdb, le reste
    // exclusivement de TMDB.
    expect(response.data?.dvd).toEqual({
      director: 'Gore Verbinski',
      releaseYear: 2007,
      duration: 169,
      edition: null,
      region: null,
      format: '2-Disc',
    });
    expect(response.data?.countryCodes).toEqual(['US']);
  });

  it('scenario Avatar (bonus) : suffixe retailer nettoyé, hints édition/packaging détectés, cover TMDB en repli (aucune image UPC)', async () => {
    const upcLookup = jest
      .fn()
      .mockResolvedValue(parseUpcItemDbFixture(AVATAR_FIXTURE, AVATAR_BARCODE));
    const tmdbSearch = jest.fn().mockResolvedValue(AVATAR_TMDB_SEARCH_RESULTS);
    const tmdbGetDetails = jest.fn().mockResolvedValue(AVATAR_TMDB_DETAILS);
    const resolver = buildResolver(upcLookup, tmdbSearch, tmdbGetDetails);

    const response = await resolver.resolve(AVATAR_BARCODE);

    // Suffixe "by 20th Century Fox by James Cameron (B01GWD9VG2)" retiré
    // (deux occurrences de " by "), bracket d'édition retiré, année jamais
    // devinée (aucune dans un groupe entre crochets).
    expect(tmdbSearch).toHaveBeenCalledWith('Avatar', null);
    expect(tmdbGetDetails).toHaveBeenCalledWith(19995);

    expect(response.status).toBe('matched');
    expect(response.data?.dvd).toEqual({
      director: 'James Cameron',
      releaseYear: 2009,
      duration: 162,
      edition: "Extended Collector's Edition",
      region: null,
      format: 'Three-Disc',
    });
    expect(response.data?.countryCodes).toEqual(['US', 'GB']);
    // Aucune image UPCitemdb exploitable pour cette fixture (comme documenté
    // réellement pour Avatar) — repli sur le poster TMDB.
    expect(response.cover?.url).toBe(AVATAR_TMDB_DETAILS.posterUrl);
  });

  it('scenario Cheerios (contrôle négatif) : no_match, TMDB jamais appelé', async () => {
    const upcLookup = jest
      .fn()
      .mockResolvedValue(parseUpcItemDbFixture(CHEERIOS_FIXTURE, CHEERIOS_BARCODE));
    const tmdbSearch = jest.fn();
    const tmdbGetDetails = jest.fn();
    const resolver = buildResolver(upcLookup, tmdbSearch, tmdbGetDetails);

    const response = await resolver.resolve(CHEERIOS_BARCODE);

    expect(response.status).toBe('no_match');
    expect(response.match).toBe(false);
    expect(response.data).toBeNull();
    expect(response.cover).toBeNull();
    expect(tmdbSearch).not.toHaveBeenCalled();
    expect(tmdbGetDetails).not.toHaveBeenCalled();
  });
});
