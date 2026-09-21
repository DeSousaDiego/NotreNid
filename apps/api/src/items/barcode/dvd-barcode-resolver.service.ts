import { Injectable, Logger } from '@nestjs/common';

import { BarcodeCacheService } from './barcode-cache.service';
import { DvdEnrichmentService } from './dvd-enrichment.service';
import { cleanTitleForSearch } from './providers/tmdb.provider';
import { UpcItemDbProvider } from './providers/upcitemdb.provider';
import type {
  BarcodeResolveData,
  BarcodeResolveResponse,
  BarcodeResolveStatus,
  DvdMetadataResult,
} from './types/barcode-result.types';
import type { TmdbMovieResult, UpcItemDbPocResult } from './types/dvd-poc.types';

// 30 jours — même principe que CdBarcodeResolverService : une fiche DVD ne
// change pour ainsi dire jamais. Utilisé UNIQUEMENT pour un `'matched'`
// complet (UPC + TMDB tous deux résolus) — voir docs/DECISIONS.md.
const MATCH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// 24h, IDENTIQUE à `CdBarcodeResolverService` — conservé sans modification,
// conformément à la consigne explicite de ne pas changer cette règle sans
// justification nouvelle. Utilisé pour `'no_match'` (UPC lui-même sans
// résultat/non-vidéo) ET pour `'partial'` quand TMDB a RÉELLEMENT terminé sa
// recherche sans candidat assez confiant (résultat stable, pas transitoire) —
// jamais pour une panne technique TMDB, voir `resolve`.
const NO_MATCH_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Resolver `dvd` complet — orchestration UPCitemdb → `DvdEnrichmentService`
 * (TMDB) → fusion vers le contrat public (`BarcodeResolveResponse`), même
 * structure `resolve`/`finalize` que `CdBarcodeResolverService`/
 * `BookBarcodeResolverService`. Réutilise `BarcodeCacheService` (catégorie
 * `'dvd'`) comme les deux autres resolvers, maintenant que la forme finale
 * s'y prête (voir docs/DECISIONS.md — anticipé dès le POC initial).
 */
@Injectable()
export class DvdBarcodeResolverService {
  private readonly logger = new Logger(DvdBarcodeResolverService.name);

  constructor(
    private readonly upcItemDb: UpcItemDbProvider,
    private readonly enrichment: DvdEnrichmentService,
    private readonly cache: BarcodeCacheService,
  ) {}

  async resolve(barcode: string): Promise<BarcodeResolveResponse> {
    const cached = this.cache.get('dvd', barcode);
    if (cached) return cached;

    let upcOutcome: Awaited<ReturnType<UpcItemDbProvider['lookup']>>;
    try {
      upcOutcome = await this.upcItemDb.lookup(barcode);
    } catch (error) {
      this.logger.warn(
        `Provider ${this.upcItemDb.id} en échec pour cette recherche — ${
          error instanceof Error ? error.message : 'erreur inconnue'
        }`,
      );
      // Volontairement PAS mis en cache : un échec technique est transitoire
      // par nature, même principe que CdBarcodeResolverService.
      return this.finalize(barcode, 'provider_error', null, null, null);
    }

    if (upcOutcome.status !== 'matched') {
      if (upcOutcome.status === 'not_video') {
        this.logger.debug(
          'barcode connu mais non classifié comme vidéo (mediaType=unknown) — traité comme no_match',
        );
      }
      return this.finalize(barcode, 'no_match', null, null, NO_MATCH_TTL_MS);
    }

    const upcResult = upcOutcome.result;
    const enrichmentOutcome = await this.enrichment.enrich(upcResult);

    if (enrichmentOutcome.kind === 'resolved') {
      return this.finalize(barcode, 'matched', upcResult, enrichmentOutcome.movie, MATCH_TTL_MS);
    }

    if (enrichmentOutcome.kind === 'unresolved') {
      // Recherche TMDB terminée sans candidat assez confiant (inclut le cas
      // coffret/boxset, voir DvdEnrichmentService) — un résultat stable, pas
      // transitoire : mis en cache, mais jamais 30 jours (voir NO_MATCH_TTL_MS).
      return this.finalize(barcode, 'partial', upcResult, null, NO_MATCH_TTL_MS);
    }

    // `enrichmentOutcome.kind === 'provider_error'` : panne technique TMDB.
    // Le produit physique UPC reste identifié — jamais un `provider_error`
    // global pour autant, et jamais mis en cache (permet un enrichissement
    // ultérieur dès le prochain scan, voir docs/DECISIONS.md).
    this.logger.warn(
      `Provider tmdb en échec pour cette recherche — ${
        enrichmentOutcome.error instanceof Error
          ? enrichmentOutcome.error.message
          : 'erreur inconnue'
      }`,
    );
    return this.finalize(barcode, 'partial', upcResult, null, null);
  }

  private finalize(
    barcode: string,
    status: BarcodeResolveStatus,
    upcResult: UpcItemDbPocResult | null,
    movie: TmdbMovieResult | null,
    cacheTtlMs: number | null,
  ): BarcodeResolveResponse {
    const response: BarcodeResolveResponse = {
      barcode,
      category: 'dvd',
      status,
      match: status === 'matched',
      source: upcResult ? this.upcItemDb.id : null,
      data: buildData(upcResult, movie),
      cover: buildCoverUrl(upcResult, movie),
    };
    if (cacheTtlMs !== null) {
      this.cache.set('dvd', barcode, response, cacheTtlMs);
    }
    return response;
  }
}

function buildCoverUrl(
  upcResult: UpcItemDbPocResult | null,
  movie: TmdbMovieResult | null,
): BarcodeResolveResponse['cover'] {
  // Image de l'ÉDITION physique UPCitemdb en priorité, poster TMDB en repli —
  // choix explicite du propriétaire (voir docs/DECISIONS.md), inchangé.
  const url = upcResult?.imageUrl ?? movie?.posterUrl ?? null;
  return url ? { url } : null;
}

/**
 * Fusion contrôlée UPCitemdb + TMDB vers le contrat public — voir
 * docs/DECISIONS.md pour le mapping champ par champ complet. Jamais
 * condition/rating/notes/owners (propres à l'exemplaire, aucun fournisseur
 * externe ne peut les connaître — même principe que CD/book).
 */
function buildData(
  upcResult: UpcItemDbPocResult | null,
  movie: TmdbMovieResult | null,
): BarcodeResolveData | null {
  if (!upcResult) return null;

  // Le titre UPC brut contient du bruit de packaging/édition (voir
  // `cleanTitleForSearch`) — jamais utilisé tel quel comme repli, même quand
  // TMDB n'a rien résolu (statut `'partial'`).
  const cleanedUpcTitle = cleanTitleForSearch(upcResult.rawTitle ?? '') || upcResult.rawTitle;
  const countryCodes = movie?.countryCodes ?? [];

  const dvd: DvdMetadataResult = {
    // TMDB EXCLUSIVEMENT — jamais déduits d'UPCitemdb, `null` en `'partial'`.
    director: movie?.director ?? null,
    releaseYear: movie?.releaseYear ?? null,
    duration: movie?.runtime ?? null,
    // UPCitemdb EXCLUSIVEMENT — déjà renseignés dès `'partial'`.
    edition: upcResult.editionHint,
    region: upcResult.regionHint,
    format: upcResult.packagingHint,
  };

  return {
    title: movie?.title ?? cleanedUpcTitle ?? null,
    description: movie?.overview ?? upcResult.description ?? null,
    book: null,
    cd: null,
    dvd,
    countryCodes: countryCodes.length > 0 ? countryCodes : null,
  };
}
