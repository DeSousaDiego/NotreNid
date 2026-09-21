import { Injectable } from '@nestjs/common';

/**
 * TMDB documente une limite bien plus généreuse qu'UPCitemdb (vérifié sur la
 * documentation officielle avant implémentation, voir docs/DECISIONS.md) :
 * l'ancienne limite stricte de 40 requêtes/10s a été désactivée en 2019, la
 * limite actuelle tourne autour de ~40 requêtes/seconde, sans quota
 * journalier documenté. 250ms (4 req/s) laisse volontairement une marge très
 * large sous ce plafond — notre usage reste de toute façon faible (déclenché
 * par un scan utilisateur, jamais en masse) : ce n'est qu'un filet de
 * précaution, pas un ajustement fin au plafond documenté.
 */
const MIN_INTERVAL_MS = 250;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Limiteur de débit process-local pour `api.themoviedb.org` — même mécanique
 * que `MusicBrainzRateLimiterService`/`UpcItemDbRateLimiterService` (chaîne
 * de promesses FIFO), avec un espacement bien plus court car TMDB n'impose
 * aucun quota journalier contraignant (voir ce fichier).
 */
@Injectable()
export class TmdbRateLimiterService {
  private chain: Promise<void> = Promise.resolve();
  private lastStartedAt = 0;

  schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      const waitMs = MIN_INTERVAL_MS - (Date.now() - this.lastStartedAt);
      if (waitMs > 0) await delay(waitMs);
      this.lastStartedAt = Date.now();
      return task();
    });

    this.chain = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
  }
}
