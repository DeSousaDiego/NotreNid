import { MusicBrainzArtistCacheService } from './musicbrainz-artist-cache.service';

const ARTIST_MBID = '070d193a-845c-479f-980e-bef15710653e';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

describe('MusicBrainzArtistCacheService', () => {
  let service: MusicBrainzArtistCacheService;

  beforeEach(() => {
    service = new MusicBrainzArtistCacheService();
  });

  it('returns undefined for an artist MBID never set', () => {
    expect(service.get(ARTIST_MBID)).toBeUndefined();
  });

  it('returns the cached country before expiry', () => {
    service.set(ARTIST_MBID, 'US');
    expect(service.get(ARTIST_MBID)).toBe('US');
  });

  it('caches a confirmed absence of country as null, distinct from never-set (undefined)', () => {
    service.set(ARTIST_MBID, null);
    expect(service.get(ARTIST_MBID)).toBeNull();
  });

  it('keys are scoped by artist MBID', () => {
    service.set(ARTIST_MBID, 'US');
    expect(service.get('some-other-mbid')).toBeUndefined();
  });

  it('expires an entry past the 30-day TTL', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    service.set(ARTIST_MBID, 'US');
    nowSpy.mockReturnValue(1_000_000 + THIRTY_DAYS_MS + 1);

    expect(service.get(ARTIST_MBID)).toBeUndefined();
    nowSpy.mockRestore();
  });

  it('overwrites a previous entry for the same artist MBID', () => {
    service.set(ARTIST_MBID, 'US');
    service.set(ARTIST_MBID, 'GB');

    expect(service.get(ARTIST_MBID)).toBe('GB');
  });
});
