import { Injectable } from '@nestjs/common';

/**
 * MusicBrainz exige environ 1 requête/seconde en moyenne par adresse IP
 * source, sous peine de 503 (voir docs/DECISIONS.md pour les sources
 * consultées) — un délai légèrement supérieur à 1000ms absorbe la latence
 * réseau/horloge sans viser l'exactitude à la milliseconde.
 */
const MIN_INTERVAL_MS = 1100;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Limiteur de débit process-local, volontairement sans nouvelle dépendance
 * (pas de `Bottleneck`/`p-queue` — voir docs/DECISIONS.md, même principe que
 * `BarcodeCacheService` pour le cache) : une simple chaîne de promesses fait
 * office de file d'attente FIFO, garantissant qu'aucune requête vers
 * `musicbrainz.org` (recherche ET retries) ne démarre moins de
 * `MIN_INTERVAL_MS` après la précédente — jamais de rafale, y compris entre
 * plusieurs recherches concurrentes déclenchées par des households différents.
 *
 * **Limite connue, à ne jamais perdre de vue sur Render** : cette limite est
 * *process-local*. Si l'API passait un jour à plusieurs instances (scaling
 * horizontal), chaque instance aurait sa propre file et son propre rythme
 * d'appel — le débit agrégé vers MusicBrainz pourrait alors dépasser 1/s côté
 * serveur MusicBrainz, qui limite par IP source (toutes les instances
 * derrière la même IP sortante Render y contribuent). Passer alors à un
 * verrou partagé (ex. une table Postgres dédiée) si ce scénario se
 * concrétise — non justifié tant qu'une seule instance tourne.
 */
@Injectable()
export class MusicBrainzRateLimiterService {
  private chain: Promise<void> = Promise.resolve();
  private lastStartedAt = 0;

  /**
   * Met `task` en file — elle démarre dès que son tour arrive ET qu'au moins
   * `MIN_INTERVAL_MS` s'est écoulé depuis le démarrage de la précédente. Un
   * échec de `task` (rejet) ne bloque jamais les tâches suivantes de la file.
   */
  schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      const waitMs = MIN_INTERVAL_MS - (Date.now() - this.lastStartedAt);
      if (waitMs > 0) await delay(waitMs);
      this.lastStartedAt = Date.now();
      return task();
    });

    // Poursuit la file quel que soit le sort de `run` — jamais de blocage
    // permanent après une tâche en échec.
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
  }
}
