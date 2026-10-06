import { Inject, Injectable, Logger } from '@nestjs/common';

import { BarcodeCacheService } from './barcode-cache.service';
import { DvdEnrichmentService } from './dvd-enrichment.service';
import { ProductImageValidator } from './product-image-validator.service';
import { BarcodeProviderError } from './providers/barcode-provider.error';
import {
  DVD_PRODUCT_PROVIDER,
  type DvdProductLookupOutcome,
  type DvdProductProvider,
} from './providers/dvd-product-provider.interface';
import { cleanTitleForSearch } from './providers/tmdb.provider';
import type {
  BarcodeResolveData,
  BarcodeResolveResponse,
  BarcodeResolveStatus,
  DvdMetadataResult,
} from './types/barcode-result.types';
import type { TmdbMovieResult, DvdProductResult } from './types/dvd-poc.types';

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
 * Resolver `dvd` complet — orchestration provider produit configuré
 * (`DVD_PRODUCT_PROVIDER` : Digit-Eyes ou UPCitemdb, voir
 * `dvd-product-provider.factory.ts`) → `DvdEnrichmentService` (TMDB) → fusion
 * vers le contrat public (`BarcodeResolveResponse`), même structure
 * `resolve`/`finalize` que `CdBarcodeResolverService`/
 * `BookBarcodeResolverService`. Ne connaît jamais le fournisseur concret.
 * Réutilise `BarcodeCacheService` (catégorie `'dvd'`) comme les deux autres
 * resolvers.
 */
@Injectable()
export class DvdBarcodeResolverService {
  private readonly logger = new Logger(DvdBarcodeResolverService.name);

  constructor(
    @Inject(DVD_PRODUCT_PROVIDER) private readonly productProvider: DvdProductProvider,
    private readonly enrichment: DvdEnrichmentService,
    private readonly cache: BarcodeCacheService,
    private readonly imageValidator: ProductImageValidator,
  ) {}

  async resolve(barcode: string): Promise<BarcodeResolveResponse> {
    const cached = this.cache.get('dvd', barcode);
    if (cached) return cached;

    let productOutcome: DvdProductLookupOutcome;
    try {
      productOutcome = await this.productProvider.lookup(barcode);
    } catch (error) {
      const kind = error instanceof BarcodeProviderError ? error.kind : 'unavailable';
      this.logger.warn(
        `Provider ${this.productProvider.id} en échec (${kind}) pour cette recherche — ${
          error instanceof Error ? error.message : 'erreur inconnue'
        }`,
      );
      // Volontairement PAS mis en cache : un échec technique est transitoire
      // par nature, même principe que CdBarcodeResolverService.
      return this.finalize(barcode, 'provider_error', null, null, null, null);
    }

    if (productOutcome.status !== 'matched') {
      if (productOutcome.status === 'not_video') {
        this.logger.debug(
          'barcode connu mais sans signal vidéo (mediaType=unknown) — traité comme no_match',
        );
      }
      return this.finalize(barcode, 'no_match', null, null, null, NO_MATCH_TTL_MS);
    }

    const product = productOutcome.result;
    // Vérification de l'image fournisseur EN PARALLÈLE de TMDB : n'ajoute
    // aucune latence tant qu'elle reste sous la durée de l'enrichissement, et
    // ne rejette jamais (voir `ProductImageValidator`).
    const [enrichmentOutcome, productImageUsable] = await Promise.all([
      this.enrichment.enrich(product),
      this.imageValidator.isUsable(product.imageUrl),
    ]);
    const productImageUrl = productImageUsable ? product.imageUrl : null;

    if (enrichmentOutcome.kind === 'resolved') {
      return this.finalize(
        barcode,
        'matched',
        product,
        enrichmentOutcome.movie,
        productImageUrl,
        MATCH_TTL_MS,
      );
    }

    if (enrichmentOutcome.kind === 'unresolved') {
      // Recherche TMDB terminée sans candidat assez confiant (inclut le cas
      // coffret/boxset, voir DvdEnrichmentService) — un résultat stable, pas
      // transitoire : mis en cache, mais jamais 30 jours (voir NO_MATCH_TTL_MS).
      return this.finalize(barcode, 'partial', product, null, productImageUrl, NO_MATCH_TTL_MS);
    }

    // `enrichmentOutcome.kind === 'provider_error'` : panne technique TMDB.
    // Le produit physique reste identifié — jamais un `provider_error` global
    // pour autant, et jamais mis en cache (permet un enrichissement ultérieur
    // dès le prochain scan, voir docs/DECISIONS.md).
    this.logger.warn(
      `Provider tmdb en échec pour cette recherche — ${
        enrichmentOutcome.error instanceof Error
          ? enrichmentOutcome.error.message
          : 'erreur inconnue'
      }`,
    );
    return this.finalize(barcode, 'partial', product, null, productImageUrl, null);
  }

  private finalize(
    barcode: string,
    status: BarcodeResolveStatus,
    product: DvdProductResult | null,
    movie: TmdbMovieResult | null,
    productImageUrl: string | null,
    cacheTtlMs: number | null,
  ): BarcodeResolveResponse {
    const response: BarcodeResolveResponse = {
      barcode,
      category: 'dvd',
      status,
      match: status === 'matched',
      source: product ? this.productProvider.id : null,
      data: buildData(product, movie),
      cover: buildCoverUrl(productImageUrl, movie),
    };
    if (cacheTtlMs !== null) {
      this.cache.set('dvd', barcode, response, cacheTtlMs);
    }
    return response;
  }
}

/**
 * Jaquette de l'ÉDITION physique du fournisseur en priorité, poster TMDB en
 * repli — choix explicite du propriétaire (voir docs/DECISIONS.md), inchangé.
 * `productImageUrl` n'est renseignée que si `ProductImageValidator` l'a jugée
 * exploitable (HTTPS, accessible) : une URL morte ou en clair ne masque
 * jamais un poster TMDB valide.
 */
function buildCoverUrl(
  productImageUrl: string | null,
  movie: TmdbMovieResult | null,
): BarcodeResolveResponse['cover'] {
  const url = productImageUrl ?? movie?.posterUrl ?? null;
  return url ? { url } : null;
}

/**
 * Fusion contrôlée fournisseur produit + TMDB vers le contrat public — voir
 * docs/DECISIONS.md pour le mapping champ par champ complet. Jamais
 * condition/rating/notes/owners (propres à l'exemplaire, aucun fournisseur
 * externe ne peut les connaître — même principe que CD/book).
 */
function buildData(
  upcResult: DvdProductResult | null,
  movie: TmdbMovieResult | null,
): BarcodeResolveData | null {
  if (!upcResult) return null;

  // Le titre UPC brut contient du bruit de packaging/édition (voir
  // `cleanTitleForSearch`) — jamais utilisé tel quel comme repli, même quand
  // TMDB n'a rien résolu (statut `'partial'`).
  const cleanedUpcTitle = cleanTitleForSearch(upcResult.rawTitle ?? '') || upcResult.rawTitle;
  const countryCodes = movie?.countryCodes ?? [];

  const dvd: DvdMetadataResult = {
    // TMDB EXCLUSIVEMENT — jamais déduits du fournisseur produit, `null` en `'partial'`.
    director: movie?.director ?? null,
    releaseYear: movie?.releaseYear ?? null,
    duration: movie?.runtime ?? null,
    // Fournisseur produit EXCLUSIVEMENT — déjà renseignés dès `'partial'`.
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
