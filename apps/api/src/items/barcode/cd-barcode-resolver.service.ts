import { Injectable, Logger } from '@nestjs/common';

import { BarcodeCacheService } from './barcode-cache.service';
import { MusicBrainzProvider } from './providers/musicbrainz.provider';
import type {
  BarcodeResolveResponse,
  BarcodeResolveStatus,
  CdProviderLookupResult,
  CdProviderSource,
} from './types/barcode-result.types';

const MATCH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours — une fiche CD ne change pour ainsi dire jamais.
const NO_MATCH_TTL_MS = 24 * 60 * 60 * 1000; // 24h — laisse une chance à un ajout ultérieur chez MusicBrainz.

/**
 * Résolution `cd` : MusicBrainz est le seul provider pour l'instant (voir
 * docs/DECISIONS.md — pas de fournisseur de repli comme pour `book`, faute
 * d'une seconde source équivalente actuellement intégrée). Décalque
 * volontaire de `BookBarcodeResolverService` (même structure `resolve`/
 * `finalize`, mêmes règles de cache) pour qu'ajouter un futur fournisseur de
 * repli CD ne demande qu'un changement local à cette classe, jamais un
 * changement d'architecture côté contrôleur/dispatcher/mobile.
 */
@Injectable()
export class CdBarcodeResolverService {
  private readonly logger = new Logger(CdBarcodeResolverService.name);

  constructor(
    private readonly musicBrainz: MusicBrainzProvider,
    private readonly cache: BarcodeCacheService,
  ) {}

  async resolve(barcode: string): Promise<BarcodeResolveResponse> {
    const cached = this.cache.get('cd', barcode);
    if (cached) return cached;

    try {
      const result = await this.musicBrainz.lookup(barcode);
      if (result) {
        return this.finalize(barcode, 'matched', this.musicBrainz.id, result, MATCH_TTL_MS);
      }
      return this.finalize(barcode, 'no_match', null, null, NO_MATCH_TTL_MS);
    } catch (error) {
      this.logger.warn(
        `Provider ${this.musicBrainz.id} en échec pour cette recherche — ${
          error instanceof Error ? error.message : 'erreur inconnue'
        }`,
      );
      // Volontairement PAS mis en cache : un échec technique est transitoire
      // par nature, le prochain scan doit retenter le provider.
      return this.finalize(barcode, 'provider_error', null, null, null);
    }
  }

  private finalize(
    barcode: string,
    status: BarcodeResolveStatus,
    source: CdProviderSource | null,
    result: CdProviderLookupResult | null,
    cacheTtlMs: number | null,
  ): BarcodeResolveResponse {
    const response: BarcodeResolveResponse = {
      barcode,
      category: 'cd',
      status,
      match: status === 'matched',
      source,
      data: result
        ? {
            title: result.title,
            description: null,
            book: null,
            cd: result.cd,
            dvd: null,
            countryCodes: null,
          }
        : null,
      cover: result?.coverUrl ? { url: result.coverUrl } : null,
    };
    if (cacheTtlMs !== null) {
      this.cache.set('cd', barcode, response, cacheTtlMs);
    }
    return response;
  }
}
