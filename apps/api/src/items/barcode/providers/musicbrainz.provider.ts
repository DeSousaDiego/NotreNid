import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BarcodeProviderError } from './barcode-provider.error';
import type { CdBarcodeProvider } from './cd-provider.interface';
import { CoverArtArchiveProvider } from './cover-art-archive.provider';
import { MusicBrainzArtistCacheService } from './musicbrainz-artist-cache.service';
import { MusicBrainzRateLimiterService } from './musicbrainz-rate-limiter.service';
import type { CdProviderLookupResult } from '../types/barcode-result.types';

interface MusicBrainzArtistCredit {
  name?: string;
  joinphrase?: string;
  artist?: { id?: string; name?: string };
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

/** Réponse de `GET /ws/2/artist/{mbid}` — champs de base uniquement (comme
 * `packaging` sur une release, `country`/`area` sont retournés sans `inc=`
 * supplémentaire, vérifié par un appel réel avant implémentation, voir
 * docs/DECISIONS.md). `begin-area` (lieu de naissance/formation, souvent une
 * ville) est volontairement absente de ce type : sa sémantique ne correspond
 * PAS à "pays de l'artiste" (un artiste peut naître ailleurs que dans son pays
 * d'activité), contrairement à `country`/`area`. */
interface MusicBrainzArtistLookupResponse {
  id?: string;
  /** Code ISO 3166-1 alpha-2 (ex. "US") — dérivé par MusicBrainz de `area`
   * quand celle-ci est un pays ; source primaire pour `cd.artistCountry`. */
  country?: string;
  area?: {
    /** Non-vide UNIQUEMENT quand `area` représente un pays (l'ISO 3166-1 ne
     * s'applique qu'aux pays) — repli valide, même sémantique que `country`,
     * pour le cas rare où `country` serait absent alors que `area` est
     * renseignée. */
    'iso-3166-1-codes'?: string[];
  };
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

// Même principe que `COVER_ART_ARCHIVE_TIMEOUT_MS` (cover-art-archive.provider.ts) :
// enrichissement non bloquant, une seule tentative (pas de retry contrairement
// à la recherche release — voir `fetchArtistCountrySafely`), un budget propre
// et court plutôt qu'un partage du budget de la recherche.
const DEFAULT_ARTIST_TIMEOUT_MS = 4000;

// MBID de l'artiste spécial "Various Artists" de MusicBrainz (compilations),
// vérifié par un appel réel le 2026-09-21 (`GET /ws/2/artist/?query=artist:"Various
// Artists"&fmt=json` → premier résultat, score 100, type "Other") — voir
// docs/DECISIONS.md. Ne représente aucun artiste réel : son pays ne doit
// jamais être exposé comme `cd.artistCountry`, même si MusicBrainz venait un
// jour à lui assigner une `area`.
const VARIOUS_ARTISTS_MBID = '89ad4ac3-39f7-470e-963a-56509c546377';

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
 * Détermine le MBID de l'artiste principal, uniquement quand il est
 * SANS AMBIGUÏTÉ — voir docs/DECISIONS.md pour la justification complète :
 *
 * - Exactement UN `artist-credit` (`joinArtistCredit` peut légitimement en
 *   concaténer plusieurs pour l'affichage — ex. "Prince & The New Power
 *   Generation" — mais aucune règle fiable ne permet de désigner lequel des
 *   deux crédits est "le" pays de l'artiste à retenir) : deux crédits ou plus
 *   → `null`, jamais un choix arbitraire (premier, plus connu, etc.).
 * - Ce crédit unique doit exposer un `artist.id` (MBID) — absent → `null`
 *   (rien à interroger).
 * - Ce MBID ne doit pas être celui de l'artiste spécial "Various Artists"
 *   (`VARIOUS_ARTISTS_MBID`) : une compilation n'a pas de pays d'artiste.
 *
 * Zéro crédit (`artist-credit` absent/vide) → `null` également : `lookup`
 * n'appelle cette fonction qu'après avoir déjà trouvé une release, mais un
 * credit vide reste possible en théorie (donnée MusicBrainz incomplète).
 */
export function resolveMainArtistMbid(
  credits: MusicBrainzArtistCredit[] | undefined,
): string | null {
  if (!credits || credits.length !== 1) return null;
  const mbid = credits[0]?.artist?.id;
  if (!mbid || mbid === VARIOUS_ARTISTS_MBID) return null;
  return mbid;
}

/**
 * `country` en priorité (déjà un code ISO 3166-1 alpha-2, ex. "US" — vérifié
 * par un appel réel, voir docs/DECISIONS.md). Repli sur `area['iso-3166-1-codes'][0]`
 * UNIQUEMENT si `country` est absent : même donnée sous-jacente (l'ISO 3166-1
 * ne s'applique qu'aux pays, donc un `iso-3166-1-codes` non vide confirme que
 * `area` représente bien un pays, pas une simple sémantique approchante).
 * `begin-area` (lieu de naissance/formation) n'est JAMAIS utilisé ici — voir
 * `MusicBrainzArtistLookupResponse`, sa sémantique ne correspond pas à "pays
 * de l'artiste" (ex. un artiste ayant émigré aurait un `begin-area` trompeur).
 */
export function extractArtistCountry(artist: MusicBrainzArtistLookupResponse): string | null {
  return artist.country ?? artist.area?.['iso-3166-1-codes']?.[0] ?? null;
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
    private readonly artistCache: MusicBrainzArtistCacheService,
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

    const candidates = body.releases ?? [];
    const release = selectBestRelease(candidates, barcode);
    if (!release) return null;

    const coverUrl = await this.fetchCoverSafely(release.id);
    const artistMbid = resolveMainArtistMbid(release['artist-credit']);
    const artistCountry = artistMbid
      ? await this.fetchArtistCountrySafely(artistMbid, userAgent)
      : null;

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
        artistCountry,
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
   * Enrichissement non bloquant et best-effort — jamais de retry (contrairement
   * à `fetchWithRetry`, dont l'échec fait échouer toute la résolution CD) :
   * une panne, un timeout ou une limite de débit sur CET appel ne doit jamais
   * transformer un match MusicBrainz déjà valide en `provider_error`, exigence
   * explicite (voir docs/DECISIONS.md). Passe malgré tout par
   * `MusicBrainzRateLimiterService.schedule` (même hôte `musicbrainz.org` que
   * la recherche release, donc soumis au même espacement ~1 req/s) —
   * contrairement à `CoverArtArchiveProvider`, un hôte distinct non concerné.
   *
   * Cache dédié (`MusicBrainzArtistCacheService`, 30 jours) consulté AVANT tout
   * appel réseau : un HIT (pays trouvé ou son absence déjà confirmée) évite
   * totalement le second appel, y compris son passage par le rate limiter.
   * Seule une résolution réussie est mise en cache — jamais un échec technique
   * (transitoire par nature), pour ne jamais reproduire le problème de cache
   * d'un résultat transitoire déjà rencontré côté `no_match` (voir
   * docs/DECISIONS.md).
   */
  private async fetchArtistCountrySafely(
    artistMbid: string,
    userAgent: string,
  ): Promise<string | null> {
    const cached = this.artistCache.get(artistMbid);
    if (cached !== undefined) return cached;

    const timeoutMs =
      this.configService.get<number>('MUSICBRAINZ_ARTIST_TIMEOUT_MS') ?? DEFAULT_ARTIST_TIMEOUT_MS;
    const url = `https://musicbrainz.org/ws/2/artist/${encodeURIComponent(artistMbid)}?fmt=json`;

    try {
      const response = await this.rateLimiter.schedule(() => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        return fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': userAgent, Accept: 'application/json' },
        }).finally(() => clearTimeout(timeout));
      });

      if (!response.ok) {
        this.logger.warn(`Réponse HTTP ${response.status} — pays de l'artiste ignoré`);
        return null;
      }

      const body = (await response.json()) as MusicBrainzArtistLookupResponse;
      const country = extractArtistCountry(body);
      this.artistCache.set(artistMbid, country);
      return country;
    } catch (error) {
      const cause =
        error instanceof Error && error.name === 'AbortError'
          ? 'timeout'
          : 'erreur réseau ou réponse illisible';
      this.logger.warn(
        `Échec (${cause}) sur l'appel artiste — pays de l'artiste ignoré (${
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
