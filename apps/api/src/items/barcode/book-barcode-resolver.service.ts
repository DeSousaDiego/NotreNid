import { Injectable, Logger } from '@nestjs/common';

import { BarcodeCacheService } from './barcode-cache.service';
import { isIsbn13Candidate, normalizeIsbnForLookup } from './barcode-validation.util';
import type { BookBarcodeProvider } from './providers/book-provider.interface';
import { GoogleBooksProvider } from './providers/google-books.provider';
import { OpenLibraryProvider } from './providers/open-library.provider';
import type {
  BarcodeResolveResponse,
  BarcodeResolveStatus,
  BookProviderLookupResult,
  BookProviderSource,
} from './types/barcode-result.types';

const MATCH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours — une fiche livre ne change pour ainsi dire jamais.
const NO_MATCH_TTL_MS = 24 * 60 * 60 * 1000; // 24h — laisse une chance à un ajout ultérieur chez un provider.

/**
 * Résolution `book` : Google Books en principal, Open Library en repli — voir
 * docs/DECISIONS.md pour la justification de l'ordre. Chaque étape (forme
 * ISBN, cache, chaîne de providers) est isolée pour rester testable
 * indépendamment.
 */
@Injectable()
export class BookBarcodeResolverService {
  private readonly logger = new Logger(BookBarcodeResolverService.name);
  private readonly providers: BookBarcodeProvider[];

  constructor(
    googleBooks: GoogleBooksProvider,
    openLibrary: OpenLibraryProvider,
    private readonly cache: BarcodeCacheService,
  ) {
    this.providers = [googleBooks, openLibrary];
  }

  async resolve(barcode: string): Promise<BarcodeResolveResponse> {
    const cached = this.cache.get('book', barcode);
    if (cached) return cached;

    // Validation de FORME (ISBN-13 structurel) — ne dit rien sur l'existence
    // réelle du livre, seulement que ce code n'a pas la forme d'un ISBN et
    // qu'il est donc inutile d'interroger des providers qui n'indexent les
    // livres que par ISBN.
    if (!isIsbn13Candidate(barcode)) {
      return this.finalize(barcode, 'no_match', null, null, NO_MATCH_TTL_MS);
    }

    const isbn = normalizeIsbnForLookup(barcode);

    // `provider_error` uniquement si TOUTE la chaîne a échoué techniquement —
    // dès qu'un provider répond (même par un résultat vide), on considère
    // avoir une réponse fiable ("no_match"), pas une panne.
    let anyProviderSucceeded = false;

    for (const provider of this.providers) {
      try {
        const result = await provider.lookup(isbn);
        anyProviderSucceeded = true;
        if (result) {
          return this.finalize(barcode, 'matched', provider.id, result, MATCH_TTL_MS);
        }
      } catch (error) {
        this.logger.warn(
          `Provider ${provider.id} en échec pour cette recherche — ${
            error instanceof Error ? error.message : 'erreur inconnue'
          }`,
        );
      }
    }

    if (!anyProviderSucceeded) {
      // Volontairement PAS mis en cache : un échec technique est transitoire
      // par nature, le prochain scan doit retenter tous les providers.
      return this.finalize(barcode, 'provider_error', null, null, null);
    }

    return this.finalize(barcode, 'no_match', null, null, NO_MATCH_TTL_MS);
  }

  private finalize(
    barcode: string,
    status: BarcodeResolveStatus,
    source: BookProviderSource | null,
    result: BookProviderLookupResult | null,
    cacheTtlMs: number | null,
  ): BarcodeResolveResponse {
    const response: BarcodeResolveResponse = {
      barcode,
      category: 'book',
      status,
      match: status === 'matched',
      source,
      data: result
        ? {
            title: result.title,
            description: result.description,
            book: result.book,
            cd: null,
            dvd: null,
            countryCodes: null,
          }
        : null,
      cover: result?.coverUrl ? { url: result.coverUrl } : null,
    };
    if (cacheTtlMs !== null) {
      this.cache.set('book', barcode, response, cacheTtlMs);
    }
    return response;
  }
}
