import { Injectable } from '@nestjs/common';

import type { BarcodeResolveResponse } from './types/barcode-result.types';

interface CacheEntry {
  value: BarcodeResolveResponse;
  expiresAt: number;
}

/**
 * Cache mémoire process-local, volontairement sans dépendance nouvelle (pas de
 * Redis/`@nestjs/cache-manager`) — voir docs/DECISIONS.md pour le raisonnement
 * complet. But : éviter de solliciter Google Books/Open Library à chaque scan
 * du même produit (plusieurs foyers scannant le même livre, ou un même foyer
 * qui reteste), et préparer MusicBrainz (Bloc futur, limite de requêtes bien
 * plus stricte que Google Books).
 *
 * **Limites connues, à ne jamais perdre de vue sur Render** :
 * - Perdu à chaque redémarrage/redéploiement du service (pas de persistance) —
 *   c'est un cache de confort, jamais une source de vérité.
 * - Non partagé entre plusieurs instances : si le plan Render passe un jour à
 *   plusieurs instances (scaling horizontal), chaque instance a son propre
 *   cache, avec un taux de succès réduit d'autant — pas d'incohérence
 *   fonctionnelle pour autant (une entrée par instance reste correcte, juste
 *   moins efficace). Passer alors à un cache partagé (Redis, ou une table
 *   Postgres dédiée) si le taux de succès observé le justifie.
 * - Croissance non bornée dans le temps si jamais nettoyée : `resolve()` purge
 *   paresseusement une entrée expirée à la lecture, mais une entrée jamais
 *   relue après expiration reste en mémoire jusqu'au redémarrage. Volume
 *   attendu négligeable (un item par code-barres réellement scanné) — à
 *   revoir seulement si ça devient un problème réel.
 */
@Injectable()
export class BarcodeCacheService {
  private readonly entries = new Map<string, CacheEntry>();

  private key(category: string, barcode: string): string {
    return `${category}:${barcode}`;
  }

  get(category: string, barcode: string): BarcodeResolveResponse | undefined {
    const entry = this.entries.get(this.key(category, barcode));
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(this.key(category, barcode));
      return undefined;
    }
    return entry.value;
  }

  set(category: string, barcode: string, value: BarcodeResolveResponse, ttlMs: number): void {
    this.entries.set(this.key(category, barcode), { value, expiresAt: Date.now() + ttlMs });
  }
}
