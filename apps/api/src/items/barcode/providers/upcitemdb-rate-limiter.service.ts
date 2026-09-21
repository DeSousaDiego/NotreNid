import { Injectable } from '@nestjs/common';

/**
 * Plan FREE/trial UPCitemdb (vérifié sur la documentation officielle avant
 * implémentation — voir docs/DECISIONS.md) : 100 requêtes combinées/jour,
 * burst limit de 6 lookups/minute (HTTP 429 `TOO_FAST` au-delà). 10500ms —
 * légèrement au-dessus de 60000/6=10000ms — absorbe la latence réseau/horloge
 * sans viser l'exactitude à la milliseconde, même principe que
 * `MusicBrainzRateLimiterService.MIN_INTERVAL_MS`. Ne fait PAS de suivi du
 * quota journalier (100/jour) ici : ce compteur est côté UPCitemdb
 * (`X-RateLimit-Remaining`/`EXCEED_LIMIT`), un suivi local dupliquerait un
 * état déjà autoritatif côté fournisseur et serait faux après un redémarrage
 * du process — voir `UpcItemDbProvider`, qui traite `EXCEED_LIMIT` comme
 * `provider_error` sans jamais retenter.
 */
const MIN_INTERVAL_MS = 10_500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Limiteur de débit process-local pour `api.upcitemdb.com` — décalque exact de
 * `MusicBrainzRateLimiterService` (même mécanique de chaîne de promesses FIFO,
 * mêmes limites connues : process-local, perdu au redémarrage, non partagé
 * entre plusieurs instances Render) : voir ce fichier pour la justification
 * complète, non répétée ici.
 */
@Injectable()
export class UpcItemDbRateLimiterService {
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
