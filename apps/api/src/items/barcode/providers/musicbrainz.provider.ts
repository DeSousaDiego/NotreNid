import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BarcodeProviderError } from './barcode-provider.error';
import type { CdBarcodeProvider } from './cd-provider.interface';
import { CoverArtArchiveProvider } from './cover-art-archive.provider';
import { MusicBrainzRateLimiterService } from './musicbrainz-rate-limiter.service';
import type { CdProviderLookupResult } from '../types/barcode-result.types';

interface MusicBrainzArtistCredit {
  name?: string;
  joinphrase?: string;
  artist?: { name?: string };
}

interface MusicBrainzLabelInfo {
  label?: { name?: string };
}

interface MusicBrainzMedium {
  format?: string;
}

export interface MusicBrainzRelease {
  id: string;
  score?: number;
  title?: string;
  status?: string;
  date?: string;
  country?: string;
  barcode?: string;
  /** Type de boîtier/packaging physique (ex. "Jewel Case", "Digipak",
   * "Cardboard/Paper Sleeve") — champ de base MusicBrainz, retourné sans
   * `inc=` supplémentaire. C'est ce champ, et non `media[].format` (le
   * SUPPORT — CD, 2×CD… — une notion différente), qui alimente
   * `CdMetadataResult.format` — voir docs/DECISIONS.md. */
  packaging?: string;
  'label-info'?: MusicBrainzLabelInfo[];
  media?: MusicBrainzMedium[];
  'artist-credit'?: MusicBrainzArtistCredit[];
}

interface MusicBrainzSearchResponse {
  count?: number;
  releases?: MusicBrainzRelease[];
}

// Requiert un contact identifiable dans le User-Agent (politique MusicBrainz —
// voir docs/DECISIONS.md pour les sources consultées) ; surchargeable via
// `MUSICBRAINZ_USER_AGENT` si l'URL de contact change.
const DEFAULT_USER_AGENT = 'NotreNid/0.1.0 (https://github.com/DeSousaDiego/NotreNid)';

// Budget TOTAL (tentatives + attente imposée par le rate limiter comprises),
// jamais un timeout par tentative — même principe que
// `OPEN_LIBRARY_TIMEOUT_BUDGET_MS` (voir open-library.provider.ts et
// docs/DECISIONS.md).
const DEFAULT_TIMEOUT_BUDGET_MS = 8000;
const MAX_ATTEMPTS = 2;
const MIN_ATTEMPT_TIMEOUT_MS = 1000;

// MusicBrainz documente un HTTP 503 en cas de dépassement de sa limite de
// débit ; 429 est inclus par prudence défensive (jamais observé dans leur
// documentation actuelle, mais un statut standard pour ce cas chez d'autres
// fournisseurs) — voir docs/DECISIONS.md. Contrairement à Open Library, aucun
// délai fixe entre tentatives ici : `MusicBrainzRateLimiterService` impose
// déjà un espacement minimal entre deux requêtes réelles, retries compris.
const RETRYABLE_HTTP_STATUSES = new Set([429, 503]);

/** `publish_date`-like : MusicBrainz `date` peut être `"2001"`, `"2001-03"` ou
 * `"2001-03-12"` — seuls les 4 premiers chiffres nous intéressent. */
function parseReleaseYear(date: string | undefined): number | null {
  if (!date) return null;
  const match = /^\d{4}/.exec(date);
  if (!match) return null;
  const year = Number.parseInt(match[0], 10);
  return Number.isInteger(year) && year > 0 ? year : null;
}

/**
 * Reconstruit le nom d'artiste affiché à partir d'`artist-credit` — MusicBrainz
 * fournit déjà le `joinphrase` exact à insérer entre chaque crédit (ex.
 * `"Artist A"` + `" feat. "` + `"Artist B"`), donc une simple concaténation
 * ordonnée restitue le nom canonique, sans réinventer de séparateur générique
 * comme le fait `OpenLibraryProvider` pour les auteurs (voir docs/DECISIONS.md
 * — plusieurs artistes, `CdMetadata.artist` reste un champ texte unique).
 */
function joinArtistCredit(credits: MusicBrainzArtistCredit[] | undefined): string | null {
  if (!credits || credits.length === 0) return null;
  const joined = credits
    .map((credit) => `${credit.name ?? credit.artist?.name ?? ''}${credit.joinphrase ?? ''}`)
    .join('');
  return joined.trim() || null;
}

/**
 * Stratégie déterministe de sélection parmi plusieurs releases MusicBrainz
 * partageant le même code-barres — voir docs/DECISIONS.md pour la
 * justification complète :
 *
 * 1. Correspondance EXACTE du code-barres uniquement (`release.barcode ===
 *    barcode`) : la recherche Lucene de MusicBrainz peut renvoyer des
 *    résultats approchants même sur le champ dédié `barcode:` — jamais retenu
 *    un résultat dont le code-barres ne correspond pas exactement à la
 *    demande. Aucune correspondance exacte → `null` (traité comme `no_match`
 *    par le resolver, jamais une supposition).
 * 2. Parmi les correspondances exactes, un score de complétude (statut
 *    "Official" fortement valorisé, puis date/pays/label/format présents)
 *    départage les candidats — jamais un choix arbitraire.
 * 3. À score égal, l'ordre de pertinence renvoyé par MusicBrainz est conservé
 *    (tri stable) : premier résultat stable selon l'ordre du fournisseur,
 *    jamais un second critère inventé.
 *
 * Volontairement PAS de critère "a une couverture" : le vérifier pour chaque
 * candidat coûterait un appel Cover Art Archive par candidat, avant même de
 * savoir lequel sera retenu — la couverture n'est récupérée qu'une fois pour
 * la release déjà choisie (voir `MusicBrainzProvider.lookup`).
 */
export function selectBestRelease(
  releases: MusicBrainzRelease[],
  barcode: string,
): MusicBrainzRelease | null {
  const exactMatches = releases.filter((release) => release.barcode === barcode);
  if (exactMatches.length === 0) return null;

  const completeness = (release: MusicBrainzRelease): number => {
    let score = 0;
    if (release.status === 'Official') score += 10;
    if (release.date) score += 1;
    if (release.country) score += 1;
    if (release['label-info']?.some((info) => info.label?.name)) score += 1;
    if (release.media?.[0]?.format) score += 1;
    return score;
  };

  return [...exactMatches].sort((a, b) => completeness(b) - completeness(a))[0] ?? null;
}

/**
 * Provider principal (et unique pour l'instant, voir docs/DECISIONS.md) pour
 * `cd` : recherche MusicBrainz par code-barres, puis enrichit la release
 * retenue d'une couverture via Cover Art Archive. Contrairement à
 * `book` (Google Books → Open Library, deux sources indépendantes pour la
 * même donnée), Cover Art Archive n'est pas un fournisseur de repli : il
 * dépend du MBID renvoyé par MusicBrainz et n'est donc composé qu'à
 * l'intérieur de ce provider, jamais comme un pair dans une chaîne de
 * fallback au niveau du resolver.
 */
@Injectable()
export class MusicBrainzProvider implements CdBarcodeProvider {
  readonly id = 'musicbrainz' as const;
  private readonly logger = new Logger(MusicBrainzProvider.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly rateLimiter: MusicBrainzRateLimiterService,
    private readonly coverArtArchive: CoverArtArchiveProvider,
  ) {}

  async lookup(barcode: string): Promise<CdProviderLookupResult | null> {
    const budgetMs =
      this.configService.get<number>('MUSICBRAINZ_TIMEOUT_BUDGET_MS') ?? DEFAULT_TIMEOUT_BUDGET_MS;
    const userAgent =
      this.configService.get<string>('MUSICBRAINZ_USER_AGENT') ?? DEFAULT_USER_AGENT;
    // `+` littéral requis par MusicBrainz pour `inc=` — construit à la main
    // plutôt que via `URLSearchParams` (qui encoderait `+` en `%2B`).
    const url = `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(
      `barcode:${barcode}`,
    )}&fmt=json&inc=labels+media+artist-credits`;

    const response = await this.fetchWithRetry(url, budgetMs, userAgent, barcode);

    if (!response.ok) {
      this.logger.warn(`Réponse HTTP ${response.status}`);
      throw new BarcodeProviderError(this.id, `MusicBrainz a répondu ${response.status}.`);
    }

    let body: MusicBrainzSearchResponse;
    try {
      body = (await response.json()) as MusicBrainzSearchResponse;
    } catch (error) {
      throw new BarcodeProviderError(this.id, 'Réponse MusicBrainz illisible.', error);
    }

    const release = selectBestRelease(body.releases ?? [], barcode);
    if (!release) return null;

    const coverUrl = await this.fetchCoverSafely(release.id);

    return {
      title: release.title ?? null,
      cd: {
        artist: joinArtistCredit(release['artist-credit']),
        releaseYear: parseReleaseYear(release.date),
        label: release['label-info']?.[0]?.label?.name ?? null,
        // `packaging` (boîtier), jamais `media[].format` (support — CD,
        // 2×CD… — hors de propos ici : la catégorie dit déjà "CD"). Aucune
        // valeur inventée si MusicBrainz ne fournit pas ce champ.
        format: release.packaging ?? null,
      },
      coverUrl,
    };
  }

  /**
   * `CoverArtArchiveProvider.fetchFrontCoverUrl` ne doit déjà jamais lever
   * (voir sa documentation) — ce filet supplémentaire garantit malgré tout
   * qu'une régression là-bas ne puisse jamais transformer un match MusicBrainz
   * valide en `provider_error` ici, exigence explicite (voir
   * docs/DECISIONS.md).
   */
  private async fetchCoverSafely(releaseMbid: string): Promise<string | null> {
    try {
      return await this.coverArtArchive.fetchFrontCoverUrl(releaseMbid);
    } catch (error) {
      this.logger.warn(
        `Cover Art Archive a levé de façon inattendue — couverture ignorée (${
          error instanceof Error ? error.message : 'erreur inconnue'
        })`,
      );
      return null;
    }
  }

  /**
   * Même principe budget-total que `OpenLibraryProvider.fetchWithRetry`
   * (voir ce fichier) — chaque tentative passe par
   * `MusicBrainzRateLimiterService.schedule`, qui impose déjà l'espacement
   * minimal entre requêtes réelles vers `musicbrainz.org` : aucun délai fixe
   * supplémentaire entre tentatives ici, contrairement à Open Library.
   */
  private async fetchWithRetry(
    url: string,
    budgetMs: number,
    userAgent: string,
    barcode: string,
  ): Promise<Response> {
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

      try {
        const response = await this.rateLimiter.schedule(() => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), timeoutMs);
          return fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': userAgent, Accept: 'application/json' },
          }).finally(() => clearTimeout(timeout));
        });

        if (response.ok || !RETRYABLE_HTTP_STATUSES.has(response.status)) {
          return response;
        }
        lastResponse = response;
        this.logger.warn(
          `tentative ${attempt}/${MAX_ATTEMPTS} échouée (HTTP ${response.status}, budget restant ${Math.max(0, deadline - Date.now())}ms, barcode masqué, longueur ${barcode.length})`,
        );
      } catch (error) {
        lastError = error;
        const cause =
          error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'erreur réseau';
        this.logger.warn(
          `tentative ${attempt}/${MAX_ATTEMPTS} échouée (${cause}, budget restant ${Math.max(0, deadline - Date.now())}ms, barcode masqué, longueur ${barcode.length})`,
        );
      }
    }

    if (lastResponse) return lastResponse;
    throw new BarcodeProviderError(
      this.id,
      'MusicBrainz injoignable, timeout ou limite de débit dépassée.',
      lastError,
    );
  }
}
