import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BarcodeProviderError } from './barcode-provider.error';
import { TmdbRateLimiterService } from './tmdb-rate-limiter.service';
import {
  detectEditionHint,
  detectMediaType,
  detectPackagingHint,
  detectRegionHint,
} from './upcitemdb.provider';
import { ISO_COUNTRY_CODES } from '../../iso-country-codes.constant';
import type { TmdbMovieResult } from '../types/dvd-poc.types';

// ---------------------------------------------------------------------------
// Réponses brutes TMDB — champs réellement observés via des appels réels
// (voir docs/DECISIONS.md) sur GET /3/search/movie et GET
// /3/movie/{id}?append_to_response=credits, aucun champ ajouté par
// supposition.
// ---------------------------------------------------------------------------

export interface TmdbSearchResult {
  id: number;
  title?: string;
  original_title?: string;
  release_date?: string;
  popularity?: number;
}

interface TmdbSearchResponse {
  results?: TmdbSearchResult[];
}

interface TmdbCrewMember {
  name?: string;
  job?: string;
}

interface TmdbProductionCountry {
  iso_3166_1?: string;
}

interface TmdbMovieDetailsResponse {
  id: number;
  title?: string;
  release_date?: string;
  runtime?: number;
  overview?: string;
  poster_path?: string;
  production_countries?: TmdbProductionCountry[];
  credits?: { crew?: TmdbCrewMember[] };
}

interface TmdbErrorBody {
  status_code?: number;
  status_message?: string;
}

// Requiert un contact identifiable, même bonne pratique que les autres
// providers — TMDB ne l'exige pas explicitement pour l'API REST (contrairement
// au User-Agent MusicBrainz), mais rien ne l'interdit non plus.
const DEFAULT_USER_AGENT = 'NotreNid/0.1.0 (https://github.com/DeSousaDiego/NotreNid)';

const DEFAULT_TIMEOUT_BUDGET_MS = 8000;
const MAX_ATTEMPTS = 2;
const MIN_ATTEMPT_TIMEOUT_MS = 1000;

// Contrairement à UPCitemdb (jamais de retry sur 429, quota journalier
// précieux), TMDB ne documente aucun quota journalier — retenter un 429 ou un
// 5xx transitoire est donc acceptable ici, même principe que MusicBrainz.
// Voir docs/DECISIONS.md.
const RETRYABLE_HTTP_STATUSES = new Set([429, 500, 502, 503, 504]);

const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// =============================================================================
// Nettoyage du titre pour la recherche TMDB — fonctions pures, testées
// isolément (voir tmdb.provider.spec.ts).
// =============================================================================

/**
 * Un groupe entre crochets/parenthèses est retiré UNIQUEMENT si son contenu
 * correspond à un signal de packaging/édition/format/région déjà détecté par
 * les fonctions du POC UPCitemdb (réutilisées ici plutôt que dupliquées) —
 * jamais un groupe conservant un doute (ex. `(B01GWD9VG2)`, un code produit
 * réel observé dans le titre Avatar, ne matche aucun de ces motifs et reste
 * en place à ce stade — voir `stripTrailingByClause` pour ce cas précis).
 */
function isNoiseBracketContent(content: string): boolean {
  return (
    detectMediaType(content) !== 'unknown' ||
    detectEditionHint(content) !== null ||
    detectPackagingHint(content) !== null ||
    detectRegionHint(content) !== null
  );
}

function stripNoiseBrackets(text: string): string {
  return text.replace(/[([][^)\]]*[)\]]/g, (group) => {
    const inner = group.slice(1, -1);
    return isNoiseBracketContent(inner) ? ' ' : group;
  });
}

/**
 * Retire un suffixe du type `by 20th Century Fox by James Cameron
 * (B01GWD9VG2)` — bruit de fiche retailer (studio/personne/code produit),
 * observé réellement dans le titre Avatar. **Exige au moins DEUX occurrences**
 * de `" by "` avant de retirer quoi que ce soit : un vrai titre de film
 * contient parfois UN `" by "` (ex. "Stand by Me"), jamais deux — ce garde-fou
 * évite de détruire un titre légitime, conformément à la consigne explicite
 * de ne jamais retirer un mot qui en fait réellement partie.
 */
function stripTrailingByClause(text: string): string {
  const occurrences = text.match(/\sby\s/gi) ?? [];
  if (occurrences.length < 2) return text;
  const idx = text.search(/\sby\s/i);
  const candidate = text.slice(0, idx).trim();
  return candidate.length > 0 ? candidate : text;
}

const LOOSE_DVD_WORD = /\bdvd\b/gi;
const LOOSE_BLURAY_WORD = /\bblu[-\s]?ray\b/gi;

/** Filet supplémentaire pour un titre où "DVD"/"Blu-ray" apparaîtrait hors de
 * tout crochet/parenthèse — jamais observé sur les 4 titres réels de ce POC,
 * mais un mot isolé "DVD"/"Blu-ray" ne fait par construction jamais partie
 * du titre d'un film. */
function stripLooseFormatWords(text: string): string {
  return text.replace(LOOSE_DVD_WORD, ' ').replace(LOOSE_BLURAY_WORD, ' ');
}

function collapseWhitespaceAndPunctuation(text: string): string {
  return text
    .replace(/\+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s:,\-–—]+|[\s:,\-–—]+$/g, '')
    .trim();
}

/**
 * Titre de recherche nettoyé à partir de `UpcItemDbPocResult.rawTitle` — voir
 * docs/DECISIONS.md pour la justification détaillée de chaque étape et sa
 * vérification sur les 4 titres réels DVD/Blu-ray de ce POC. **Garde-fou
 * final** : si le nettoyage détruit ENTIÈREMENT le titre (résultat vide), le
 * titre BRUT est renvoyé tel quel plutôt qu'une requête TMDB vide — jamais un
 * seuil de longueur minimale arbitraire ici, un vrai titre de film peut être
 * légitimement très court (ex. "9", l'un des titres réels de ce POC — un
 * garde-fou basé sur la longueur l'aurait à tort renvoyé au titre brut non
 * nettoyé, "9 (Blu-ray Disc, 2009)").
 */
export function cleanTitleForSearch(rawTitle: string): string {
  const original = rawTitle.trim();
  if (!original) return '';

  let cleaned = stripNoiseBrackets(original);
  cleaned = stripTrailingByClause(cleaned);
  cleaned = stripLooseFormatWords(cleaned);
  cleaned = collapseWhitespaceAndPunctuation(cleaned);

  return cleaned.length > 0 ? cleaned : original;
}

// Bornes larges mais non absurdes (premier film ≈ fin XIXe, jamais plus de 2
// ans dans le futur) — évite de capturer un nombre à 4 chiffres qui ne serait
// manifestement pas une année.
const YEAR_PATTERN = /\b(1[89]\d{2}|20\d{2})\b/g;

/**
 * Année exploitable comme critère TMDB — voir consigne explicite : "ne
 * l'invente pas depuis une chaîne ambiguë". Cherche UNIQUEMENT à l'intérieur
 * de groupes entre crochets/parenthèses (le seul contexte où une année a été
 * observée réellement, ex. "9 (Blu-ray Disc, 2009)") : un nombre à 4 chiffres
 * hors de ce contexte pourrait être n'importe quoi (référence catalogue,
 * etc.), jamais supposé être une année. Si plusieurs années DIFFÉRENTES sont
 * trouvées → `null` (ambigu, jamais un choix arbitraire entre elles).
 */
export function extractYearHint(rawTitle: string): number | null {
  const currentYear = new Date().getFullYear();
  const bracketGroups = rawTitle.match(/[([][^)\]]*[)\]]/g) ?? [];
  const years = new Set<number>();

  for (const group of bracketGroups) {
    const matches = group.match(YEAR_PATTERN) ?? [];
    for (const raw of matches) {
      const year = Number.parseInt(raw, 10);
      if (year <= currentYear + 2) years.add(year);
    }
  }

  if (years.size !== 1) return null;
  const [year] = years;
  return year ?? null;
}

// =============================================================================
// Sélection déterministe du film — fonctions pures.
// =============================================================================

function normalizeTitle(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Distance de Levenshtein itérative standard (DP à deux lignes) — aucune
 * nouvelle dépendance, cohérent avec le reste du projet. */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  let curr = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min((curr[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length] ?? 0;
}

export type TitleMatchTier = 'exact' | 'close' | 'far';

/**
 * `'exact'` : identique après normalisation (accents/casse/ponctuation
 * ignorés — pas une égalité stricte octet à octet, ce qui serait trop
 * fragile). `'close'` : distance de Levenshtein sous une tolérance
 * proportionnelle à la longueur (`max(2, 15% de la longueur cible)`) —
 * délibérément INSUFFISANT seul pour passer le seuil de confiance (voir
 * `MIN_CONFIDENT_SCORE`), conformément à la préférence explicite du
 * propriétaire ("faux négatif plutôt que mauvais film choisi avec
 * confiance"). Compare contre `title` ET `original_title`, retient le
 * meilleur des deux (utile pour un film au titre original non anglophone).
 */
export function titleMatchTier(
  cleanedTitle: string,
  candidateTitles: Array<string | undefined>,
): TitleMatchTier {
  const normalizedTarget = normalizeTitle(cleanedTitle);
  if (!normalizedTarget) return 'far';

  let best: TitleMatchTier = 'far';
  for (const candidate of candidateTitles) {
    if (!candidate) continue;
    const normalizedCandidate = normalizeTitle(candidate);
    if (normalizedCandidate === normalizedTarget) return 'exact';
    const tolerance = Math.max(2, Math.round(normalizedTarget.length * 0.15));
    if (levenshteinDistance(normalizedTarget, normalizedCandidate) <= tolerance) {
      best = 'close';
    }
  }
  return best;
}

function parseReleaseYear(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const match = /^(\d{4})/.exec(dateStr);
  if (!match) return null;
  const year = Number.parseInt(match[1] as string, 10);
  return Number.isInteger(year) && year > 0 ? year : null;
}

const EXACT_TITLE_SCORE = 100;
const CLOSE_TITLE_SCORE = 60;
const YEAR_EXACT_BONUS = 20;
const YEAR_OFF_BY_ONE_BONUS = 5;
const YEAR_MISMATCH_PENALTY = -30;

/** Seuil minimum pour accepter un candidat — voir docs/DECISIONS.md.
 * Atteignable UNIQUEMENT par un titre `'exact'` (60 + 20 de bonus année ne
 * suffit jamais, 80 < 100) : décision délibérée, pas un oubli — un match
 * "proche" seul ne doit jamais suffire. */
const MIN_CONFIDENT_SCORE = 100;

/** `null` = candidat écarté d'emblée (titre `'far'`, jamais retenu quel que
 * soit le reste — voir docs/DECISIONS.md), jamais un score négatif implicite
 * qui pourrait accidentellement repasser au-dessus du seuil par erreur de
 * calcul future. */
export function scoreCandidate(
  candidate: TmdbSearchResult,
  cleanedTitle: string,
  yearHint: number | null,
): number | null {
  const tier = titleMatchTier(cleanedTitle, [candidate.title, candidate.original_title]);
  if (tier === 'far') return null;

  let score = tier === 'exact' ? EXACT_TITLE_SCORE : CLOSE_TITLE_SCORE;

  if (yearHint !== null) {
    const candidateYear = parseReleaseYear(candidate.release_date);
    if (candidateYear !== null) {
      const diff = Math.abs(candidateYear - yearHint);
      if (diff === 0) score += YEAR_EXACT_BONUS;
      else if (diff === 1) score += YEAR_OFF_BY_ONE_BONUS;
      else score += YEAR_MISMATCH_PENALTY;
    }
  }

  return score;
}

/**
 * Sélection déterministe — jamais `results[0]` brut (voir consigne
 * explicite) :
 * 1. Score chaque candidat (`scoreCandidate`), écarte les `null` (titre
 *    `'far'`).
 * 2. Trie par score décroissant, puis par `popularity` décroissante —
 *    la popularité ne départage JAMAIS deux candidats de score différent,
 *    uniquement une égalité stricte de score (voir consigne : "popularité...
 *    jamais comme critère principal").
 * 3. Le meilleur candidat doit atteindre `MIN_CONFIDENT_SCORE`, sinon `null`
 *    ("aucun candidat n'atteint le seuil" → film non résolu, jamais un choix
 *    par défaut).
 */
export function selectBestMovieMatch(
  candidates: TmdbSearchResult[],
  cleanedTitle: string,
  yearHint: number | null,
): TmdbSearchResult | null {
  const scored = candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, cleanedTitle, yearHint) }))
    .filter(
      (entry): entry is { candidate: TmdbSearchResult; score: number } => entry.score !== null,
    );

  if (scored.length === 0) return null;

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.candidate.popularity ?? 0) - (a.candidate.popularity ?? 0);
  });

  const best = scored[0] as { candidate: TmdbSearchResult; score: number };
  return best.score >= MIN_CONFIDENT_SCORE ? best.candidate : null;
}

/**
 * Jointure déterministe de plusieurs réalisateurs — même principe que
 * `joinArtistCredit`/l'auteur multiple d'`OpenLibraryProvider` : notre modèle
 * `dvd.director` reste un champ texte unique, jamais un tableau. Simple
 * séparateur `", "` (TMDB ne fournit pas de `joinphrase` comme
 * `artist-credit` chez MusicBrainz).
 */
export function extractDirector(crew: Array<{ name?: string; job?: string }>): string | null {
  const directors = crew
    .filter((member) => member.job === 'Director')
    .map((member) => member.name?.trim())
    .filter((name): name is string => Boolean(name));
  return directors.length > 0 ? directors.join(', ') : null;
}

const VALID_ISO_COUNTRY_CODES: readonly string[] = ISO_COUNTRY_CODES;

function extractCountryCodes(countries: TmdbProductionCountry[] | undefined): string[] {
  if (!countries) return [];
  const codes = countries
    .map((c) => c.iso_3166_1)
    .filter(
      (code): code is string => typeof code === 'string' && VALID_ISO_COUNTRY_CODES.includes(code),
    );
  return codes;
}

function normalizeMovieDetails(body: TmdbMovieDetailsResponse): TmdbMovieResult {
  return {
    id: body.id,
    title: body.title?.trim() || null,
    overview: body.overview?.trim() || null,
    releaseYear: parseReleaseYear(body.release_date),
    runtime: typeof body.runtime === 'number' && body.runtime > 0 ? body.runtime : null,
    director: extractDirector(body.credits?.crew ?? []),
    countryCodes: extractCountryCodes(body.production_countries),
    posterUrl: body.poster_path ? `${POSTER_BASE_URL}${body.poster_path}` : null,
  };
}

// =============================================================================
// Provider HTTP.
// =============================================================================

/**
 * Provider TMDB — source de vérité pour l'ŒUVRE cinématographique
 * uniquement, jamais pour l'édition physique (voir docs/DECISIONS.md).
 * N'implémente aucune interface `*BarcodeProvider` existante : son contrat
 * (`search`/`getDetails`, deux méthodes distinctes) diffère structurellement
 * d'un simple `lookup(barcode)` — composé depuis `DvdEnrichmentService`,
 * jamais appelé directement par un resolver.
 */
@Injectable()
export class TmdbProvider {
  readonly id = 'tmdb' as const;
  private readonly logger = new Logger(TmdbProvider.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly rateLimiter: TmdbRateLimiterService,
  ) {}

  async search(query: string, yearHint: number | null): Promise<TmdbSearchResult[]> {
    const params = new URLSearchParams({ query });
    if (yearHint !== null) params.set('primary_release_year', String(yearHint));
    const url = `https://api.themoviedb.org/3/search/movie?${params.toString()}`;

    const response = await this.fetchWithRetry(url);
    if (!response.ok) {
      await this.throwForFailedResponse(response);
    }

    let body: TmdbSearchResponse;
    try {
      body = (await response.json()) as TmdbSearchResponse;
    } catch (error) {
      throw new BarcodeProviderError(this.id, 'Réponse TMDB illisible (recherche).', error);
    }

    return body.results ?? [];
  }

  async getDetails(movieId: number): Promise<TmdbMovieResult> {
    const url = `https://api.themoviedb.org/3/movie/${movieId}?append_to_response=credits`;

    const response = await this.fetchWithRetry(url);
    if (!response.ok) {
      await this.throwForFailedResponse(response);
    }

    let body: TmdbMovieDetailsResponse;
    try {
      body = (await response.json()) as TmdbMovieDetailsResponse;
    } catch (error) {
      throw new BarcodeProviderError(this.id, 'Réponse TMDB illisible (détails).', error);
    }

    return normalizeMovieDetails(body);
  }

  private async throwForFailedResponse(response: Response): Promise<never> {
    let statusMessage: string | undefined;
    try {
      statusMessage = ((await response.json()) as TmdbErrorBody).status_message;
    } catch {
      // Corps illisible — on garde le statut HTTP seul.
    }
    this.logger.warn(
      `Réponse HTTP ${response.status}${statusMessage ? ` (${statusMessage})` : ''}`,
    );
    throw new BarcodeProviderError(
      this.id,
      `TMDB a répondu ${response.status}${statusMessage ? ` (${statusMessage})` : ''}.`,
    );
  }

  /**
   * Même principe budget-total que les autres providers. Contrairement à
   * `UpcItemDbProvider`, 429 fait partie des statuts retentés (voir
   * `RETRYABLE_HTTP_STATUSES` — aucun quota journalier TMDB à préserver).
   */
  private async fetchWithRetry(url: string): Promise<Response> {
    const budgetMs =
      this.configService.get<number>('TMDB_TIMEOUT_BUDGET_MS') ?? DEFAULT_TIMEOUT_BUDGET_MS;
    const token = this.configService.get<string>('TMDB_READ_ACCESS_TOKEN');
    const userAgent = this.configService.get<string>('TMDB_USER_AGENT') ?? DEFAULT_USER_AGENT;

    if (!token) {
      throw new BarcodeProviderError(this.id, 'TMDB_READ_ACCESS_TOKEN absent de la configuration.');
    }

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
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
              'User-Agent': userAgent,
            },
          }).finally(() => clearTimeout(timeout));
        });

        if (response.ok || !RETRYABLE_HTTP_STATUSES.has(response.status)) {
          return response;
        }
        lastResponse = response;
        this.logger.warn(
          `tentative ${attempt}/${MAX_ATTEMPTS} échouée (HTTP ${response.status}, budget restant ${Math.max(0, deadline - Date.now())}ms)`,
        );
      } catch (error) {
        lastError = error;
        const cause =
          error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'erreur réseau';
        this.logger.warn(
          `tentative ${attempt}/${MAX_ATTEMPTS} échouée (${cause}, budget restant ${Math.max(0, deadline - Date.now())}ms)`,
        );
      }
    }

    if (lastResponse) return lastResponse;
    throw new BarcodeProviderError(
      this.id,
      'TMDB injoignable, timeout ou limite de débit dépassée.',
      lastError,
    );
  }
}
