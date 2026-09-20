import { MusicBrainzRateLimiterService } from './musicbrainz-rate-limiter.service';

describe('MusicBrainzRateLimiterService', () => {
  it('runs a single scheduled task immediately, without imposing a wait', async () => {
    const limiter = new MusicBrainzRateLimiterService();
    const start = Date.now();

    await limiter.schedule(() => Promise.resolve('done'));

    expect(Date.now() - start).toBeLessThan(200);
  });

  it('spaces out consecutive scheduled tasks by at least ~1 request/second', async () => {
    const limiter = new MusicBrainzRateLimiterService();
    const startedAt: number[] = [];

    const record = () => {
      startedAt.push(Date.now());
      return Promise.resolve();
    };

    await Promise.all([
      limiter.schedule(record),
      limiter.schedule(record),
      limiter.schedule(record),
    ]);

    expect(startedAt).toHaveLength(3);
    const [first, second, third] = startedAt as [number, number, number];
    expect(second - first).toBeGreaterThanOrEqual(1000);
    expect(third - second).toBeGreaterThanOrEqual(1000);
  }, 10000);

  it('preserves submission order — never reorders queued tasks', async () => {
    const limiter = new MusicBrainzRateLimiterService();
    const completedOrder: number[] = [];

    await Promise.all([
      limiter.schedule(async () => {
        completedOrder.push(1);
      }),
      limiter.schedule(async () => {
        completedOrder.push(2);
      }),
      limiter.schedule(async () => {
        completedOrder.push(3);
      }),
    ]);

    expect(completedOrder).toEqual([1, 2, 3]);
  }, 10000);

  it('keeps the queue alive after a scheduled task rejects — later tasks still run', async () => {
    const limiter = new MusicBrainzRateLimiterService();

    await expect(limiter.schedule(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');

    const result = await limiter.schedule(() => Promise.resolve('still works'));
    expect(result).toBe('still works');
  }, 10000);

  it('resolves each caller with its own task result, not another caller’s', async () => {
    const limiter = new MusicBrainzRateLimiterService();

    const [a, b] = await Promise.all([
      limiter.schedule(() => Promise.resolve('a')),
      limiter.schedule(() => Promise.resolve('b')),
    ]);

    expect(a).toBe('a');
    expect(b).toBe('b');
  }, 5000);
});
