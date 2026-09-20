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

// Open Library répond nettement plus lentement que Google Books depuis Render (voir
// docs/DECISIONS.md) — mais ce délai est un BUDGET TOTAL pour l'ensemble des tentatives
// (retry et délai entre tentatives compris), pas un timeout par tentative : deux tentatives
// de `DEFAULT_TIMEOUT_BUDGET_MS` chacune ferait attendre le mobile jusqu'à ~18s rien que pour
// ce fournisseur, en plus des ~5s déjà consommées par l'échec de Google Books. Porté par sa
// propre variable d'environnement (`OPEN_LIBRARY_TIMEOUT_BUDGET_MS`) pour pouvoir l'ajuster
// sans toucher au timeout du fournisseur principal.
const DEFAULT_TIMEOUT_BUDGET_MS = 9000;

// Une seule tentative supplémentaire (2 essais au total), partageant le même budget — voir
// `fetchWithRetry`. Au-delà, un fournisseur de repli qui reste en échec doit laisser la main
// au reste de la chaîne plutôt que de retarder davantage la réponse.
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 300;

// Timeout minimal accordé à une tentative même si le budget restant, divisé entre les
// tentatives restantes, donnerait moins — en dessous, la requête n'aurait pratiquement aucune
// chance d'aboutir. Reste borné par le budget réellement restant (voir `fetchWithRetry`) :
// avec un budget déjà presque épuisé, ce plancher n'allonge jamais l'attente au-delà du budget.
const MIN_ATTEMPT_TIMEOUT_MS = 1000;

// Codes HTTP considérés comme des pannes réellement transitoires côté serveur (passerelle/
// service indisponible) — voir `fetchWithRetry`. Tout autre statut (4xx, ou 5xx hors de cette
// liste, ex. 500 générique) est un résultat définitif, jamais retenté.
const RETRYABLE_HTTP_STATUSES = new Set([502, 503, 504]);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    const budgetMs =
      this.configService.get<number>('OPEN_LIBRARY_TIMEOUT_BUDGET_MS') ?? DEFAULT_TIMEOUT_BUDGET_MS;
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

    const response = await this.fetchWithRetry(url, budgetMs, isbn);

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

  /**
   * Au plus `MAX_ATTEMPTS` essais, TOUTES tentatives et délai de retry confondus bornés par
   * `budgetMs` au total (jamais `budgetMs` par tentative) — voir la justification de
   * `DEFAULT_TIMEOUT_BUDGET_MS`. Chaque tentative reçoit une part du budget restant
   * (`remainingBudgetMs / tentatives restantes`), avec un plancher `MIN_ATTEMPT_TIMEOUT_MS`
   * en dessous duquel retenter n'aurait guère de chance d'aboutir — plancher lui-même toujours
   * ramené au budget réellement restant, qui ne peut donc jamais être dépassé.
   *
   * Retenté uniquement sur : timeout (`AbortController`), échec de `fetch()` avant toute
   * réponse (coupure réseau, DNS…), ou une réponse HTTP dans `RETRYABLE_HTTP_STATUSES`
   * (502/503/504 — passerelle ou service indisponible, réellement transitoires). Tout autre
   * statut HTTP (4xx, ou 5xx hors de cette liste) est renvoyé tel quel dès la première
   * réponse, sans nouvelle tentative : `lookup` le traite comme un résultat définitif.
   */
  private async fetchWithRetry(url: URL, budgetMs: number, isbn: string): Promise<Response> {
    const deadline = Date.now() + budgetMs;
    let lastError: unknown;
    let lastResponse: Response | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const attemptsRemaining = MAX_ATTEMPTS - attempt + 1;
      const remainingBudgetMs = deadline - Date.now();
      if (remainingBudgetMs <= 0) {
        this.logger.warn(`budget épuisé avant la tentative ${attempt}/${MAX_ATTEMPTS}`);
        break;
      }

      const timeoutMs = Math.min(
        Math.max(MIN_ATTEMPT_TIMEOUT_MS, Math.floor(remainingBudgetMs / attemptsRemaining)),
        remainingBudgetMs,
      );

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (response.ok || !RETRYABLE_HTTP_STATUSES.has(response.status)) {
          return response;
        }
        lastResponse = response;
        this.logger.warn(
          `tentative ${attempt}/${MAX_ATTEMPTS} échouée (HTTP ${response.status}, budget restant ${Math.max(0, deadline - Date.now())}ms, isbn masqué, longueur ${isbn.length})`,
        );
      } catch (error) {
        lastError = error;
        const cause =
          error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'erreur réseau';
        this.logger.warn(
          `tentative ${attempt}/${MAX_ATTEMPTS} échouée (${cause}, budget restant ${Math.max(0, deadline - Date.now())}ms, isbn masqué, longueur ${isbn.length})`,
        );
      } finally {
        clearTimeout(timeout);
      }

      if (attempt < MAX_ATTEMPTS) {
        const remainingAfterAttempt = deadline - Date.now();
        if (remainingAfterAttempt <= 0) break;
        await delay(Math.min(RETRY_DELAY_MS, remainingAfterAttempt));
      }
    }

    if (lastResponse) return lastResponse;
    throw new BarcodeProviderError(this.id, 'Open Library injoignable ou timeout.', lastError);
  }
}
