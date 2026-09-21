import { UpcItemDbRateLimiterService } from './upcitemdb-rate-limiter.service';

// Timers factices : `MIN_INTERVAL_MS` (10.5s) rendrait les tests d'espacement
// réels beaucoup trop lents (~21s pour 3 tâches) — voir
// `musicbrainz-rate-limiter.service.spec.ts` pour le même test avec de vrais
// timers, acceptable là-bas car son intervalle (1.1s) reste raisonnable.
describe('UpcItemDbRateLimiterService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs a single scheduled task immediately, without imposing a wait', async () => {
    const limiter = new UpcItemDbRateLimiterService();
    const task = jest.fn().mockResolvedValue('done');

    const result = await limiter.schedule(task);

    expect(result).toBe('done');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('spaces out consecutive scheduled tasks by at least 10.5s (plan FREE, 6 lookups/minute)', async () => {
    const limiter = new UpcItemDbRateLimiterService();
    const startedAt: number[] = [];
    const record = () => {
      startedAt.push(Date.now());
      return Promise.resolve();
    };

    const pending = Promise.all([
      limiter.schedule(record),
      limiter.schedule(record),
      limiter.schedule(record),
    ]);
    await jest.advanceTimersByTimeAsync(30_000);
    await pending;

    expect(startedAt).toHaveLength(3);
    const [first, second, third] = startedAt as [number, number, number];
    expect(second - first).toBeGreaterThanOrEqual(10_500);
    expect(third - second).toBeGreaterThanOrEqual(10_500);
  });

  it('preserves submission order — never reorders queued tasks', async () => {
    const limiter = new UpcItemDbRateLimiterService();
    const completedOrder: number[] = [];

    const pending = Promise.all([
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
    await jest.advanceTimersByTimeAsync(30_000);
    await pending;

    expect(completedOrder).toEqual([1, 2, 3]);
  });

  it('keeps the queue alive after a scheduled task rejects — later tasks still run', async () => {
    const limiter = new UpcItemDbRateLimiterService();

    await expect(limiter.schedule(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');

    const pending = limiter.schedule(() => Promise.resolve('still works'));
    await jest.advanceTimersByTimeAsync(15_000);
    await expect(pending).resolves.toBe('still works');
  });

  it('resolves each caller with its own task result, not another caller’s', async () => {
    const limiter = new UpcItemDbRateLimiterService();

    const pending = Promise.all([
      limiter.schedule(() => Promise.resolve('a')),
      limiter.schedule(() => Promise.resolve('b')),
    ]);
    await jest.advanceTimersByTimeAsync(15_000);
    const [a, b] = await pending;

    expect(a).toBe('a');
    expect(b).toBe('b');
  });
});
