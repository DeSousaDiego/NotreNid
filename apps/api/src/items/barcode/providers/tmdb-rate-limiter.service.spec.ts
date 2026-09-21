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

  // Timers factices ici (contrairement au reste de ce fichier) : cette
  // assertion compare des écarts en millisecondes contre `MIN_INTERVAL_MS`
  // (250ms) — avec de vrais timers, un CI partagé/sous charge peut faire
  // résoudre `setTimeout(250)` avec 1ms d'avance sur l'horloge murale
  // (comportement documenté de Node/libuv, jamais un bug du rate limiter
  // lui-même — reproductible 5/5 en local sans écart, jamais observé en CI
  // avant ce lot). Les timers factices de Jest avancent une horloge VIRTUELLE
  // déterministe : `Date.now()` (mocké avec les timers) progresse exactement
  // du nombre de ms demandé, sans aucune dépendance à l'horloge murale réelle
  // ni à la charge de la machine — l'écart mesuré est donc exact, jamais
  // approximatif, et cette suite reste utilisable pour détecter une vraie
  // régression du rate limiter (ex. un écart qui deviendrait 0 ou 500).
  it('spaces out consecutive scheduled tasks by exactly 250ms of virtual time (fake timers, deterministic)', async () => {
    jest.useFakeTimers();
    try {
      const limiter = new TmdbRateLimiterService();
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

      // La première tâche s'exécute immédiatement (aucun timer) — un premier
      // flush à 0ms laisse sa promesse se résoudre et arme le timer de la
      // deuxième tâche avant d'avancer l'horloge.
      await jest.advanceTimersByTimeAsync(0);
      await jest.advanceTimersByTimeAsync(250);
      await jest.advanceTimersByTimeAsync(250);
      await pending;

      expect(startedAt).toHaveLength(3);
      const [first, second, third] = startedAt as [number, number, number];
      // Jamais exécutées immédiatement l'une après l'autre...
      expect(second).toBeGreaterThan(first);
      expect(third).toBeGreaterThan(second);
      // ...et espacées d'exactement 250ms d'horloge virtuelle, sans la marge
      // de tolérance qu'exigeraient de vrais timers.
      expect(second - first).toBe(250);
      expect(third - second).toBe(250);
    } finally {
      jest.useRealTimers();
    }
  });

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
