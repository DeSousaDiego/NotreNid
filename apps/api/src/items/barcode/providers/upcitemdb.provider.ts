import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BarcodeProviderError } from './barcode-provider.error';
import { UpcItemDbRateLimiterService } from './upcitemdb-rate-limiter.service';
import type { UpcItemDbMediaType, UpcItemDbPocResult } from '../types/dvd-poc.types';

interface UpcItemDbOffer {
  title?: string;
}

/** Champs réellement observés dans des réponses réelles `GET
 * https://api.upcitemdb.com/prod/trial/lookup?upc={code}` (voir
 * docs/DECISIONS.md pour le détail des appels de vérification) — aucun champ
 * ajouté par supposition. `category` est présent mais vide ou trompeur sur
 * les DVD/Blu-ray réels testés (ex. "Electronics > Video > Televisions" pour
 * un DVD+Blu-ray) : jamais utilisé pour la classification, voir
 * `detectMediaType`. */
interface UpcItemDbItem {
  upc?: string;
  ean?: string;
  title?: string;
  description?: string;
  brand?: string;
  category?: string;
  images?: string[];
  offers?: UpcItemDbOffer[];
}

/** `code` documenté (voir docs/DECISIONS.md, page "Responses" de la
 * documentation officielle vérifiée avant implémentation) : `"OK"` (succès),
 * `"NOT_FOUND"` (404, aucun item), `"INVALID_UPC"`/`"INVALID_QUERY"` (400),
 * `"AUTH_ERR"` (401), `"EXCEED_LIMIT"`/`"TOO_FAST"`/`"HTTP_TOO_MANY_REQUESTS"`
 * (429), `"SERVER_ERR"` (50x) — jamais typé en union stricte ici : un code
 * non documenté ne doit jamais faire planter le parsing, seulement être
 * traité prudemment (voir `lookup`). */
interface UpcItemDbLookupResponse {
  code?: string;
  total?: number;
  offset?: number;
  items?: UpcItemDbItem[];
}

// Requiert un contact identifiable dans le User-Agent, même bonne pratique
// que `MusicBrainzProvider` bien que non documentée comme obligatoire pour
// UPCitemdb — voir docs/DECISIONS.md.
const DEFAULT_USER_AGENT = 'NotreNid/0.1.0 (https://github.com/DeSousaDiego/NotreNid)';

// Budget TOTAL (tentatives + attente du rate limiter comprises), même
// principe que `MusicBrainzProvider`/`OpenLibraryProvider`.
const DEFAULT_TIMEOUT_BUDGET_MS = 8000;
const MAX_ATTEMPTS = 2;
const MIN_ATTEMPT_TIMEOUT_MS = 1000;

// Jamais 429 dans cet ensemble, contrairement à `MusicBrainzProvider` —
// décision volontaire, voir docs/DECISIONS.md : un 429 UPCitemdb signifie soit
// une rafale (`TOO_FAST`), soit le quota JOURNALIER épuisé (`EXCEED_LIMIT`),
// indiscernables sans lire le corps ; retenter consommerait une requête
// supplémentaire dans un budget de 100/jour pour un bénéfice nul si la cause
// est le quota journalier. Seuls les 5xx (`SERVER_ERR`, transitoires par
// nature) sont retentés, même principe que les autres providers.
const RETRYABLE_HTTP_STATUSES = new Set([500, 502, 503, 504]);

const DVD_KEYWORD = /\bdvd\b/i;
const BLURAY_KEYWORD = /\bblu[-\s]?ray\b/i;

/**
 * Détermine `mediaType` uniquement à partir d'un mot-clé explicite
 * ("DVD"/"Blu-ray") dans le texte fourni — jamais depuis `category` (voir
 * `UpcItemDbItem`). Un item contenant les deux mots-clés (ex. combo pack
 * "DVD + 2-Disc Blu-ray", observé réellement) est classé `'dvd'` : il
 * contient bien un disque DVD, cohérent avec la catégorie `dvd` de Notre Nid
 * (qui ne distingue pas encore Blu-ray — hors périmètre de ce POC).
 */
export function detectMediaType(text: string): UpcItemDbMediaType {
  if (DVD_KEYWORD.test(text)) return 'dvd';
  if (BLURAY_KEYWORD.test(text)) return 'bluray';
  return 'unknown';
}

// Motifs les plus spécifiques en premier : "Ultimate Collector's Edition"
// doit être capturé en entier, jamais tronqué à "Collector's Edition" parce
// que ce dernier motif aurait matché avant.
const EDITION_PATTERNS: RegExp[] = [
  /Ultimate Collector'?s Edition/i,
  /Extended Collector'?s Edition/i,
  /Collector'?s Edition/i,
  /Director'?s Cut/i,
  /Extended Edition/i,
  /Special Edition/i,
  /Anniversary Edition/i,
  /Unrated Edition/i,
  /Theatrical Edition/i,
];

export function detectEditionHint(text: string): string | null {
  for (const pattern of EDITION_PATTERNS) {
    const match = pattern.exec(text);
    if (match) return match[0];
  }
  return null;
}

// Aucun des DVD/Blu-ray réels testés pendant ce POC n'exposait de région
// explicite (voir docs/DECISIONS.md) — motif conservé car le vocabulaire
// (Region 1-6, A/B/C, Free) est standard et sans risque de faux positif,
// mais son taux de présence réel dans les données UPCitemdb reste à
// confirmer sur un échantillon plus large avant de s'y fier pour le mobile.
const REGION_PATTERN = /\bRegion[-\s]?(?:Free|[ABC]|[0-6])\b/i;

export function detectRegionHint(text: string): string | null {
  const match = REGION_PATTERN.exec(text);
  return match ? match[0] : null;
}

const DISC_COUNT_PATTERN = /\b(?:\d+|One|Two|Three|Four|Five|Six|Seven|Eight)[-\s]Discs?\b/i;
const BOX_SET_PATTERN = /\bbox\s?set\b/i;

export function detectPackagingHint(text: string): string | null {
  const discMatch = DISC_COUNT_PATTERN.exec(text);
  if (discMatch) return discMatch[0];
  const boxMatch = BOX_SET_PATTERN.exec(text);
  return boxMatch ? boxMatch[0] : null;
}

/** `item.upc`/`item.ean` doivent correspondre au barcode demandé QUAND
 * UPCitemdb les fournit (voir consigne explicite) — un item sans aucun des
 * deux champs est accepté (rien à vérifier), jamais rejeté par excès de
 * prudence. `ean` observé toujours égal à `'0' + upc` (zero-padding EAN-13
 * standard d'un UPC-A) dans les réponses réelles testées — les deux sens de
 * comparaison sont couverts pour rester correct quelle que soit la longueur
 * (8/12/13 chiffres) du barcode envoyé par notre DTO. */
function matchesBarcode(item: UpcItemDbItem, barcode: string): boolean {
  const candidates = [item.upc, item.ean].filter((v): v is string => Boolean(v));
  if (candidates.length === 0) return true;
  return candidates.some(
    (code) => code === barcode || code === `0${barcode}` || `0${code}` === barcode,
  );
}

export type UpcItemDbSelection =
  { kind: 'found'; item: UpcItemDbItem } | { kind: 'none' } | { kind: 'ambiguous' };

/**
 * Sélection déterministe parmi les items renvoyés — voir docs/DECISIONS.md :
 * 1. Ne garde que les items dont le barcode correspond exactement (voir
 *    `matchesBarcode`).
 * 2. Zéro résultat après filtre → `'none'`.
 * 3. Plusieurs résultats après filtre → `'ambiguous'` : contrairement à
 *    `selectBestRelease` (MusicBrainz), UPCitemdb ne fournit aucun signal de
 *    complétude/statut permettant de départager plusieurs items prétendant
 *    au même barcode — jamais un choix arbitraire (premier, plus complet
 *    "à l'œil"), donc traité comme `no_match` par le resolver. Jamais observé
 *    dans les tests réels de ce POC (toujours 0 ou 1 item), mais une
 *    recherche UPC peut en théorie renvoyer plusieurs entrées côté UPCitemdb
 *    (produits dupliqués en base).
 * 4. Exactement un résultat → `'found'`.
 */
export function selectMatchingItem(items: UpcItemDbItem[], barcode: string): UpcItemDbSelection {
  const matching = items.filter((item) => matchesBarcode(item, barcode));
  if (matching.length === 0) return { kind: 'none' };
  if (matching.length > 1) return { kind: 'ambiguous' };
  const [only] = matching;
  return only ? { kind: 'found', item: only } : { kind: 'none' };
}

function normalizeItem(item: UpcItemDbItem, barcode: string): UpcItemDbPocResult {
  // Texte de classification volontairement restreint à `title`/`description`
  // (jamais `offers[].title`, ni `category`) : la précision de `mediaType`
  // dépend de ce périmètre étroit — voir consigne "pas d'heuristique agressive
  // sur le titre seul", satisfaite ici en exigeant un mot-clé DVD/Blu-ray
  // explicite plutôt qu'une ressemblance de titre.
  const classificationText = [item.title, item.description].filter(Boolean).join(' ');
  // Texte d'indices élargi aux titres d'`offers` (ex. "6 Discs" observé
  // uniquement là, jamais dans le `title` principal de l'item) — risque
  // limité car ces indices n'influencent jamais `matched`/`no_match`/`partial`
  // (voir `DvdBarcodeResolverService`).
  const hintText = [item.title, item.description, ...(item.offers ?? []).map((o) => o.title)]
    .filter((v): v is string => Boolean(v))
    .join(' \n ');

  return {
    barcode,
    rawTitle: item.title?.trim() || null,
    description: item.description?.trim() || null,
    brand: item.brand?.trim() || null,
    category: item.category?.trim() || null,
    imageUrl: item.images?.[0] ?? null,
    mediaType: detectMediaType(classificationText),
    editionHint: detectEditionHint(hintText),
    regionHint: detectRegionHint(hintText),
    packagingHint: detectPackagingHint(hintText),
  };
}

export type UpcItemDbLookupOutcome =
  | { status: 'matched'; result: UpcItemDbPocResult }
  | { status: 'no_match' }
  /** Barcode connu, item trouvé et validé, mais aucun mot-clé DVD/Blu-ray
   * explicite — `result` conservé pour inspection/logs uniquement, jamais
   * exposé comme `matched` par `DvdBarcodeResolverService`. */
  | { status: 'not_video'; result: UpcItemDbPocResult };

/**
 * Provider POC `dvd` — UPCitemdb (plan FREE/trial), en attente de validation
 * de la qualité des données avant d'ajouter TMDB (voir docs/DECISIONS.md).
 * Volontairement pas encore enregistré dans `barcode.module.ts`/exposé via
 * `BarcodeResolverService` : voir `DvdBarcodeResolverService`.
 */
@Injectable()
export class UpcItemDbProvider {
  readonly id = 'upcitemdb' as const;
  private readonly logger = new Logger(UpcItemDbProvider.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly rateLimiter: UpcItemDbRateLimiterService,
  ) {}

  async lookup(barcode: string): Promise<UpcItemDbLookupOutcome> {
    const budgetMs =
      this.configService.get<number>('UPCITEMDB_TIMEOUT_BUDGET_MS') ?? DEFAULT_TIMEOUT_BUDGET_MS;
    const userAgent = this.configService.get<string>('UPCITEMDB_USER_AGENT') ?? DEFAULT_USER_AGENT;
    const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`;

    const response = await this.fetchWithRetry(url, budgetMs, userAgent, barcode);

    // `NOT_FOUND` documenté comme HTTP 404 — recherche aboutie sans résultat
    // exploitable, jamais une erreur (voir docs/DECISIONS.md).
    if (response.status === 404) {
      return { status: 'no_match' };
    }

    if (!response.ok) {
      let code: string | undefined;
      try {
        code = ((await response.json()) as UpcItemDbLookupResponse).code;
      } catch {
        // Corps illisible (ex. page HTML d'un gateway) — on garde le statut
        // HTTP seul, jamais un plantage ici.
      }
      this.logger.warn(`Réponse HTTP ${response.status}${code ? ` (${code})` : ''}`);
      throw new BarcodeProviderError(
        this.id,
        `UPCitemdb a répondu ${response.status}${code ? ` (${code})` : ''}.`,
      );
    }

    let body: UpcItemDbLookupResponse;
    try {
      body = (await response.json()) as UpcItemDbLookupResponse;
    } catch (error) {
      throw new BarcodeProviderError(this.id, 'Réponse UPCitemdb illisible.', error);
    }

    // Défensif : un 200 avec un `code` métier non-`OK` n'a jamais été observé
    // en pratique, mais ne doit jamais être traité comme un match.
    if (body.code && body.code !== 'OK') {
      return { status: 'no_match' };
    }

    const selection = selectMatchingItem(body.items ?? [], barcode);
    if (selection.kind !== 'found') return { status: 'no_match' };

    const result = normalizeItem(selection.item, barcode);
    if (result.mediaType === 'unknown') return { status: 'not_video', result };
    return { status: 'matched', result };
  }

  /**
   * Même principe budget-total que `MusicBrainzProvider.fetchWithRetry` —
   * seule différence : jamais de retry sur 429 (voir
   * `RETRYABLE_HTTP_STATUSES`). Chaque tentative passe par
   * `UpcItemDbRateLimiterService.schedule`, qui impose déjà l'espacement
   * minimal (~10.5s) entre requêtes réelles vers `api.upcitemdb.com`.
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

        // 404 (`NOT_FOUND`) n'est jamais retenté : recherche aboutie, pas un
        // échec technique — laissé passer tel quel à l'appelant.
        if (
          response.ok ||
          response.status === 404 ||
          !RETRYABLE_HTTP_STATUSES.has(response.status)
        ) {
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
      'UPCitemdb injoignable, timeout ou limite de débit dépassée.',
      lastError,
    );
  }
}
