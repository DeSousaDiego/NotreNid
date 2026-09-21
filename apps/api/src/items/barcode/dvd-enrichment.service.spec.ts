import { DvdEnrichmentService } from './dvd-enrichment.service';
import type { TmdbProvider, TmdbSearchResult } from './providers/tmdb.provider';
import type { TmdbMovieResult, UpcItemDbPocResult } from './types/dvd-poc.types';

function makeUpcResult(overrides: Partial<UpcItemDbPocResult> = {}): UpcItemDbPocResult {
  return {
    barcode: '786936815481',
    rawTitle: "Pirates of the Caribbean: At World's End (DVD + 2-Disc Blu-ray)",
    description: null,
    brand: 'Disney',
    category: 'Electronics > Video > Televisions',
    imageUrl: 'https://example.test/pirates-cover.jpg',
    mediaType: 'dvd',
    editionHint: null,
    regionHint: null,
    packagingHint: '2-Disc',
    ...overrides,
  };
}

const PIRATES_TMDB: TmdbSearchResult = {
  id: 285,
  title: "Pirates of the Caribbean: At World's End",
  original_title: "Pirates of the Caribbean: At World's End",
  release_date: '2007-05-19',
  popularity: 36.1765,
};

const PIRATES_MOVIE: TmdbMovieResult = {
  id: 285,
  title: "Pirates of the Caribbean: At World's End",
  overview: 'After losing Captain Jack Sparrow...',
  releaseYear: 2007,
  runtime: 169,
  director: 'Gore Verbinski',
  countryCodes: ['US'],
  posterUrl: 'https://image.tmdb.org/t/p/w500/jGWpG4YhpQwVmjyHEGkxEkeRf0S.jpg',
};

// Réponse réelle observée : seul candidat, un documentaire — jamais les films
// eux-mêmes (voir tmdb.provider.spec.ts pour le détail).
const DARK_KNIGHT_DOCUMENTARY: TmdbSearchResult = {
  id: 243238,
  title: 'The Fire Rises: The Creation and Impact of The Dark Knight Trilogy',
  original_title: 'The Fire Rises: The Creation and Impact of The Dark Knight Trilogy',
  release_date: '2013-09-24',
  popularity: 2.6294,
};

function fakeTmdbProvider(search: jest.Mock, getDetails: jest.Mock = jest.fn()): TmdbProvider {
  return { id: 'tmdb', search, getDetails } as unknown as TmdbProvider;
}

describe('DvdEnrichmentService', () => {
  it('resolves a real single-candidate exact match end-to-end (search → select → details)', async () => {
    const search = jest.fn().mockResolvedValue([PIRATES_TMDB]);
    const getDetails = jest.fn().mockResolvedValue(PIRATES_MOVIE);
    const service = new DvdEnrichmentService(fakeTmdbProvider(search, getDetails));

    const outcome = await service.enrich(makeUpcResult());

    expect(outcome).toEqual({ kind: 'resolved', movie: PIRATES_MOVIE });
    expect(search).toHaveBeenCalledWith("Pirates of the Caribbean: At World's End", null);
    expect(getDetails).toHaveBeenCalledWith(285);
  });

  it('passes the extracted year hint to search when the raw title has an explicit bracketed year', async () => {
    const search = jest.fn().mockResolvedValue([]);
    const service = new DvdEnrichmentService(fakeTmdbProvider(search));

    await service.enrich(makeUpcResult({ rawTitle: '9 (Blu-ray Disc, 2009)' }));

    expect(search).toHaveBeenCalledWith('9', 2009);
  });

  it('never forces a match for the real boxset case — only the documentary comes back, correctly rejected', async () => {
    const search = jest.fn().mockResolvedValue([DARK_KNIGHT_DOCUMENTARY]);
    const getDetails = jest.fn();
    const service = new DvdEnrichmentService(fakeTmdbProvider(search, getDetails));

    const outcome = await service.enrich(
      makeUpcResult({ rawTitle: 'The Dark Knight Trilogy [Blu-ray]' }),
    );

    expect(outcome).toEqual({ kind: 'unresolved' });
    expect(getDetails).not.toHaveBeenCalled();
  });

  it('is unresolved (never a crash) when the cleaned title ends up empty', async () => {
    const search = jest.fn();
    const service = new DvdEnrichmentService(fakeTmdbProvider(search));

    const outcome = await service.enrich(makeUpcResult({ rawTitle: '   ' }));

    expect(outcome).toEqual({ kind: 'unresolved' });
    expect(search).not.toHaveBeenCalled();
  });

  it('is unresolved when TMDB search returns zero results', async () => {
    const search = jest.fn().mockResolvedValue([]);
    const service = new DvdEnrichmentService(fakeTmdbProvider(search));

    const outcome = await service.enrich(makeUpcResult());

    expect(outcome).toEqual({ kind: 'unresolved' });
  });

  it('surfaces a provider_error when the search call fails technically — getDetails never attempted', async () => {
    const searchError = new Error('TMDB timeout');
    const search = jest.fn().mockRejectedValue(searchError);
    const getDetails = jest.fn();
    const service = new DvdEnrichmentService(fakeTmdbProvider(search, getDetails));

    const outcome = await service.enrich(makeUpcResult());

    expect(outcome).toEqual({ kind: 'provider_error', error: searchError });
    expect(getDetails).not.toHaveBeenCalled();
  });

  it('surfaces a provider_error when a confident candidate was selected but details fetch fails technically', async () => {
    const detailsError = new Error('TMDB 503');
    const search = jest.fn().mockResolvedValue([PIRATES_TMDB]);
    const getDetails = jest.fn().mockRejectedValue(detailsError);
    const service = new DvdEnrichmentService(fakeTmdbProvider(search, getDetails));

    const outcome = await service.enrich(makeUpcResult());

    expect(outcome).toEqual({ kind: 'provider_error', error: detailsError });
  });
});
