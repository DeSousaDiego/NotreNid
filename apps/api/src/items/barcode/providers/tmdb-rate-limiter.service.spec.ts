import { TmdbRateLimiterService } from './tmdb-rate-limiter.service';

// Vrais timers ici (contrairement à `upcitemdb-rate-limiter.service.spec.ts`) :
// l'intervalle (250ms) reste raisonnable en temps réel, même principe que
// `musicbrainz-rate-limiter.service.spec.ts` (1.1s).
describe('TmdbRateLimiterService', () => {
  it('runs a single scheduled task immediately, without imposing a wait', async () => {
    const limiter = new TmdbRateLimiterService();
    const start = Date.now();

    await limiter.schedule(() => Promise.resolve('done'));

    expect(Date.now() - start).toBeLessThan(200);
  });

  it('spaces out consecutive scheduled tasks by at least 250ms', async () => {
    const limiter = new TmdbRateLimiterService();
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
    expect(second - first).toBeGreaterThanOrEqual(250);
    expect(third - second).toBeGreaterThanOrEqual(250);
  }, 10000);

  it('preserves submission order — never reorders queued tasks', async () => {
    const limiter = new TmdbRateLimiterService();
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
    const limiter = new TmdbRateLimiterService();

    await expect(limiter.schedule(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');

    const result = await limiter.schedule(() => Promise.resolve('still works'));
    expect(result).toBe('still works');
  }, 5000);

  it('resolves each caller with its own task result, not another caller’s', async () => {
    const limiter = new TmdbRateLimiterService();

    const [a, b] = await Promise.all([
      limiter.schedule(() => Promise.resolve('a')),
      limiter.schedule(() => Promise.resolve('b')),
    ]);

    expect(a).toBe('a');
    expect(b).toBe('b');
  }, 5000);
});
