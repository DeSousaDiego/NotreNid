import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BarcodeProviderError } from './barcode-provider.error';
import type { BookBarcodeProvider } from './book-provider.interface';
import type { BookProviderLookupResult } from '../types/barcode-result.types';

interface OpenLibraryAuthor {
  name?: string;
}

interface OpenLibraryPublisher {
  name?: string;
}

interface OpenLibraryCover {
  small?: string;
  medium?: string;
  large?: string;
}

interface OpenLibraryBookData {
  title?: string;
  authors?: OpenLibraryAuthor[];
  publishers?: OpenLibraryPublisher[];
  publish_date?: string;
  number_of_pages?: number;
  cover?: OpenLibraryCover;
}

const DEFAULT_TIMEOUT_MS = 5000;

/** `publish_date` chez Open Library n'a pas de format garanti (`"2020"`,
 * `"May 2020"`, `"2020-05-01"`…) — on n'extrait que les 4 premiers chiffres
 * consécutifs trouvés, sans tenter d'interpréter le mois. */
function parsePublicationYear(publishDate: string | undefined): number | null {
  if (!publishDate) return null;
  const match = /\d{4}/.exec(publishDate);
  if (!match) return null;
  const year = Number.parseInt(match[0], 10);
  return Number.isInteger(year) && year > 0 ? year : null;
}

/**
 * Provider de repli pour `book`, interrogé uniquement si Google Books ne
 * renvoie aucun résultat exploitable (voir docs/DECISIONS.md). Le format
 * `jscmd=data` d'Open Library ne fournit ni synopsis ni code langue fiables —
 * ces deux champs restent `null` plutôt que déduits d'une source qui ne les
 * porte pas réellement.
 */
@Injectable()
export class OpenLibraryProvider implements BookBarcodeProvider {
  readonly id = 'open-library' as const;
  private readonly logger = new Logger(OpenLibraryProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async lookup(isbn: string): Promise<BookProviderLookupResult | null> {
    const timeoutMs =
      this.configService.get<number>('BARCODE_PROVIDER_TIMEOUT_MS') ?? DEFAULT_TIMEOUT_MS;
    const bibkey = `ISBN:${isbn}`;
    const url = new URL('https://openlibrary.org/api/books');
    url.searchParams.set('bibkeys', bibkey);
    url.searchParams.set('format', 'json');
    url.searchParams.set('jscmd', 'data');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (error) {
      this.logger.warn(`Échec réseau (isbn masqué, longueur ${isbn.length})`);
      throw new BarcodeProviderError(this.id, 'Open Library injoignable ou timeout.', error);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      this.logger.warn(`Réponse HTTP ${response.status}`);
      throw new BarcodeProviderError(this.id, `Open Library a répondu ${response.status}.`);
    }

    let body: Record<string, OpenLibraryBookData>;
    try {
      body = (await response.json()) as Record<string, OpenLibraryBookData>;
    } catch (error) {
      throw new BarcodeProviderError(this.id, 'Réponse Open Library illisible.', error);
    }

    const data = body[bibkey];
    if (!data) {
      return null;
    }

    return {
      title: data.title ?? null,
      description: null,
      book: {
        author:
          data.authors && data.authors.length > 0
            ? data.authors
                .map((author) => author.name)
                .filter(Boolean)
                .join(', ') || null
            : null,
        isbn,
        publisher: data.publishers?.[0]?.name ?? null,
        publicationYear: parsePublicationYear(data.publish_date),
        language: null,
        pageCount: data.number_of_pages ?? null,
      },
      coverUrl: data.cover?.large ?? data.cover?.medium ?? data.cover?.small ?? null,
    };
  }
}
