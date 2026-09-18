import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BarcodeProviderError } from './barcode-provider.error';
import type { BookBarcodeProvider } from './book-provider.interface';
import type { BookProviderLookupResult } from '../types/barcode-result.types';

interface GoogleBooksIndustryIdentifier {
  type?: string;
  identifier?: string;
}

interface GoogleBooksVolumeInfo {
  title?: string;
  authors?: string[];
  description?: string;
  publisher?: string;
  publishedDate?: string;
  language?: string;
  pageCount?: number;
  industryIdentifiers?: GoogleBooksIndustryIdentifier[];
  imageLinks?: { thumbnail?: string; smallThumbnail?: string };
}

interface GoogleBooksResponse {
  totalItems?: number;
  items?: { volumeInfo?: GoogleBooksVolumeInfo }[];
}

const DEFAULT_TIMEOUT_MS = 5000;

/** Année à 4 chiffres extraite de `publishedDate`, qui peut être `"2020"`,
 * `"2020-05"` ou `"2020-05-01"` selon la précision connue de Google Books. */
function parsePublicationYear(publishedDate: string | undefined): number | null {
  if (!publishedDate) return null;
  const year = Number.parseInt(publishedDate.slice(0, 4), 10);
  return Number.isInteger(year) && year > 0 ? year : null;
}

/** Les URLs de couverture Google Books sont historiquement en `http://` — la
 * mise à niveau vers `https://` évite un contenu mixte bloqué côté mobile. */
function toHttps(url: string | undefined): string | null {
  if (!url) return null;
  return url.replace(/^http:\/\//, 'https://');
}

/**
 * Provider principal pour `book` — voir docs/DECISIONS.md pour l'ordre de la
 * chaîne de fallback. Ne journalise jamais le corps de la réponse (peut
 * contenir des données personnelles d'un tiers, ex. avis) ni la clé API.
 */
@Injectable()
export class GoogleBooksProvider implements BookBarcodeProvider {
  readonly id = 'google-books' as const;
  private readonly logger = new Logger(GoogleBooksProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async lookup(isbn: string): Promise<BookProviderLookupResult | null> {
    const apiKey = this.configService.get<string>('GOOGLE_BOOKS_API_KEY');
    const timeoutMs =
      this.configService.get<number>('BARCODE_PROVIDER_TIMEOUT_MS') ?? DEFAULT_TIMEOUT_MS;
    const url = new URL('https://www.googleapis.com/books/v1/volumes');
    url.searchParams.set('q', `isbn:${isbn}`);
    if (apiKey) url.searchParams.set('key', apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (error) {
      this.logger.warn(`Échec réseau (isbn masqué, longueur ${isbn.length})`);
      throw new BarcodeProviderError(this.id, 'Google Books injoignable ou timeout.', error);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      this.logger.warn(`Réponse HTTP ${response.status}`);
      throw new BarcodeProviderError(this.id, `Google Books a répondu ${response.status}.`);
    }

    let body: GoogleBooksResponse;
    try {
      body = (await response.json()) as GoogleBooksResponse;
    } catch (error) {
      throw new BarcodeProviderError(this.id, 'Réponse Google Books illisible.', error);
    }

    const volumeInfo = body.items?.[0]?.volumeInfo;
    if (!body.totalItems || !volumeInfo) {
      return null;
    }

    const isbn13 = volumeInfo.industryIdentifiers?.find((id) => id.type === 'ISBN_13')?.identifier;

    return {
      title: volumeInfo.title ?? null,
      description: volumeInfo.description ?? null,
      book: {
        // Plusieurs auteurs : `BookMetadata.author` reste un champ texte unique
        // côté modèle (voir packages/shared/src/types/item.ts) — jointure lisible
        // plutôt qu'un tableau tronqué ou un seul auteur arbitrairement choisi.
        author:
          volumeInfo.authors && volumeInfo.authors.length > 0
            ? volumeInfo.authors.join(', ')
            : null,
        isbn: isbn13 ?? isbn,
        publisher: volumeInfo.publisher ?? null,
        publicationYear: parsePublicationYear(volumeInfo.publishedDate),
        language: volumeInfo.language ?? null,
        pageCount: volumeInfo.pageCount ?? null,
      },
      coverUrl: toHttps(volumeInfo.imageLinks?.thumbnail ?? volumeInfo.imageLinks?.smallThumbnail),
    };
  }
}
