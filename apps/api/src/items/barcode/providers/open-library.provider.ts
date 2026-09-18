import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BarcodeProviderError } from './barcode-provider.error';
import type { BookBarcodeProvider } from './book-provider.interface';
import type { BookProviderLookupResult } from '../types/barcode-result.types';

interface OpenLibraryAuthor {
  name?: string;
}

/**
 * Forme de `jscmd=details` (pas `jscmd=data`, qui n'expose ni `physical_format`
 * ni `covers` — confirmé en reproduisant l'appel réel, voir docs/DECISIONS.md).
 * Différences notables avec `jscmd=data` : `publishers` est un tableau de
 * chaînes (pas `{name}[]`), et la couverture se construit depuis l'identifiant
 * numérique `covers[0]`, il n'y a pas de bloc `cover: {small,medium,large}`.
 */
interface OpenLibraryEditionDetails {
  title?: string;
  authors?: OpenLibraryAuthor[];
  publishers?: string[];
  publish_date?: string;
  number_of_pages?: number;
  covers?: number[];
  physical_format?: string;
}

interface OpenLibraryBibkeyEntry {
  details?: OpenLibraryEditionDetails;
}

const DEFAULT_TIMEOUT_MS = 5000;

/** Reconstruit l'URL d'image depuis l'identifiant numérique Open Library —
 * `L` (large) pour rester cohérent avec la meilleure résolution disponible,
 * même construction que celle déjà utilisée par le champ `cover` de
 * `jscmd=data` (simple gabarit d'URL public, pas une API séparée). */
function coverUrlFromId(coverId: number | undefined): string | null {
  return coverId != null ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;
}

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
 * renvoie aucun résultat exploitable (voir docs/DECISIONS.md). `jscmd=details`
 * (et non `jscmd=data`) est nécessaire pour obtenir `physical_format` — ni
 * synopsis ni code langue fiables n'y sont pour autant disponibles ; ces deux
 * champs restent `null` plutôt que déduits d'une source qui ne les porte pas
 * réellement (`description` y contient le plus souvent une note bibliographique,
 * pas un résumé de l'œuvre).
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
    // `.json` fait partie du CHEMIN, pas seulement du paramètre `format` —
    // confirmé en reproduisant l'appel réel (curl) : `/api/books` (sans
    // extension) renvoie 404 chez Open Library, quels que soient les query
    // params, y compris `format=json` ; seul `/api/books.json` répond 200
    // avec les données attendues (cause du 404 constaté sur Render).
    const url = new URL('https://openlibrary.org/api/books.json');
    url.searchParams.set('bibkeys', bibkey);
    url.searchParams.set('format', 'json');
    url.searchParams.set('jscmd', 'details');

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

    let body: Record<string, OpenLibraryBibkeyEntry>;
    try {
      body = (await response.json()) as Record<string, OpenLibraryBibkeyEntry>;
    } catch (error) {
      throw new BarcodeProviderError(this.id, 'Réponse Open Library illisible.', error);
    }

    const data = body[bibkey]?.details;
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
        publisher: data.publishers?.[0] ?? null,
        publicationYear: parsePublicationYear(data.publish_date),
        language: null,
        pageCount: data.number_of_pages ?? null,
        format: data.physical_format ?? null,
      },
      coverUrl: coverUrlFromId(data.covers?.[0]),
    };
  }
}
