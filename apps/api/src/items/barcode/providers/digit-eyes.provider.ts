import { createHmac } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BarcodeProviderError, type BarcodeProviderErrorKind } from './barcode-provider.error';
import type { DvdProductLookupOutcome, DvdProductProvider } from './dvd-product-provider.interface';
import { positiveMsOrDefault } from '../barcode-config.util';
import {
  detectEditionHint,
  detectMediaType,
  detectPackagingHint,
  detectRegionHint,
  hasVideoCategory,
} from '../dvd-product-classification';
import type { DvdMediaType, DvdProductResult } from '../types/dvd-poc.types';

/** Champs réellement observés dans les réponses réelles de
 * `GET https://www.digit-eyes.com/gtin/v2_0/` (POC du 2026-10-06, voir
 * docs/DECISIONS.md et `test-fixtures/digiteyes/`) — seuls ceux utiles au
 * pipeline sont typés. `return_code` est une chaîne ("0") en V2. */
export interface DigitEyesResponse {
  upc_code?: string;
  return_code?: string | number;
  return_message?: string;
  description?: string | null;
  brand?: string | null;
  /** Liste séparée par des virgules — renvoyée UNIQUEMENT si demandée
   * explicitement (`field_names=all` seul ne la renvoie pas). */
  categories?: string | null;
  image?: string | null;
  usage?: string | null;
  uom?: string | null;
  manufacturer?: { company?: string | null } | null;
}

const ENDPOINT = 'https://www.digit-eyes.com/gtin/v2_0/';
// `categories` en plus de `all` : indispensable pour reconnaître un coffret
// dont le titre ne contient ni "DVD" ni "Blu-ray" (Dark Knight Trilogy, voir
// docs/DECISIONS.md).
const FIELD_NAMES = 'all,categories';
const DEFAULT_TIMEOUT_BUDGET_MS = 6000;
const MAX_ATTEMPTS = 2;
const MIN_ATTEMPT_TIMEOUT_MS = 1000;
// Seuls les 5xx sont retentés : un 4xx Digit-Eyes est déterministe
// (introuvable, signature, solde) et un retry ne changerait rien.
const RETRYABLE_HTTP_STATUSES = new Set([500, 502, 503, 504]);

/** Spec Digit-Eyes, Appendix D : `base64(HMAC-SHA1(clé = auth_key,
 * message = upc_code))`. */
export function signDigitEyesRequest(upcCode: string, authKey: string): string {
  return createHmac('sha1', authKey).update(upcCode, 'utf8').digest('base64');
}

/** Codes de retour Digit-Eyes documentés (Appendix C) signifiant une
 * recherche aboutie sans produit exploitable — jamais une erreur technique :
 * 999 introuvable, 998 code absent, 995 code invalide. */
const NO_MATCH_RETURN_CODES = new Set(['999', '998', '995']);
/** Codes 1–7 renvoyés avec un HTTP 200 : code valide mais sans produit
 * catalogue (code privé, coupon, prix au poids…). */
const NON_CATALOGUE_RETURN_CODES = new Set(['1', '2', '3', '4', '5', '6', '7']);

/**
 * Statut HTTP + code Digit-Eyes → issue normalisée. `null` = succès à
 * normaliser. Ne renvoie `no_match` (mis en cache 24h) que pour une absence
 * de produit DOCUMENTÉE : un quota, une authentification, un code inconnu ou
 * un 404 sans corps JSON (proxy, changement d'URL) restent des erreurs
 * techniques, jamais masquées en "aucun résultat".
 */
export function classifyDigitEyesFailure(
  status: number,
  returnCode: string | null,
  hasJsonBody: boolean,
): { outcome: 'no_match' } | { outcome: 'error'; kind: BarcodeProviderErrorKind } | null {
  if (status === 402 || returnCode === '666') return { outcome: 'error', kind: 'quota' };
  if (status === 401 || returnCode === '992' || returnCode === '993' || returnCode === '996') {
    return { outcome: 'error', kind: 'auth' };
  }
  if (returnCode !== null && NO_MATCH_RETURN_CODES.has(returnCode)) {
    return { outcome: 'no_match' };
  }
  if (status === 404) {
    return hasJsonBody && returnCode === null
      ? { outcome: 'no_match' }
      : { outcome: 'error', kind: 'unavailable' };
  }
  if (status === 400) return { outcome: 'error', kind: 'invalid_response' };
  if (status >= 200 && status < 300) {
    if (returnCode === null || returnCode === '0') return null;
    return NON_CATALOGUE_RETURN_CODES.has(returnCode)
      ? { outcome: 'no_match' }
      : { outcome: 'error', kind: 'unavailable' };
  }
  return { outcome: 'error', kind: 'unavailable' };
}

function stripLeadingZeros(code: string): string {
  return code.replace(/^0+/, '');
}

function splitCategories(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((category) => category.trim())
    .filter((category) => category.length > 0);
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Normalisation pure d'une réponse 200 Digit-Eyes — testée directement sur
 * les fixtures réelles (`test-fixtures/digiteyes/`).
 *
 * - Le FORMAT et les indices (édition/région/packaging) viennent uniquement
 *   du titre produit et de `uom` ; jamais de `usage`, texte libre de vendeur
 *   ("includes workout DVD", "won't play in DVD players", "Region Free"…) qui
 *   produirait de faux signaux. Les catégories ne servent qu'au signal vidéo
 *   OUI/NON (voir `hasVideoCategory`) → `'video'` si seules elles l'attestent.
 * - `description` reste `null` pour la même raison : `usage` est souvent un
 *   texte de vendeur ("Buy with confidence…") ou une répétition du titre.
 */
export function normalizeDigitEyesProduct(
  body: DigitEyesResponse,
  barcode: string,
): DvdProductLookupOutcome {
  const rawTitle = clean(body.description);
  if (!rawTitle) return { status: 'no_match' };

  // Même garde-fou que `selectMatchingItem` (UPCitemdb) : jamais un produit
  // dont le code retourné diffère du code demandé (zéros de tête ignorés —
  // Digit-Eyes renvoie un EAN-13 "0065935831686" pour un UPC-A à 12 chiffres).
  if (body.upc_code && stripLeadingZeros(body.upc_code) !== stripLeadingZeros(barcode)) {
    return { status: 'no_match' };
  }

  const categories = splitCategories(body.categories);
  const productText = [rawTitle, body.uom].filter(Boolean).join(' \n ');
  const formatType = detectMediaType(productText);
  const mediaType: DvdMediaType =
    formatType !== 'unknown' ? formatType : hasVideoCategory(categories) ? 'video' : 'unknown';

  const result: DvdProductResult = {
    barcode,
    rawTitle,
    description: null,
    brand: clean(body.brand) ?? clean(body.manufacturer?.company),
    category: categories.length > 0 ? categories.join(', ') : null,
    imageUrl: clean(body.image),
    mediaType,
    editionHint: detectEditionHint(productText),
    regionHint: detectRegionHint(productText),
    packagingHint: detectPackagingHint(productText),
  };

  return mediaType === 'unknown' ? { status: 'not_video', result } : { status: 'matched', result };
}

/** Réponse HTTP déjà entièrement lue (corps compris) dans le budget de temps. */
interface FetchedResponse {
  status: number;
  ok: boolean;
  text: string;
}

/**
 * Corps décodé selon le charset annoncé : Digit-Eyes répond en
 * `application/json; charset=ISO-8859-1` (observé), que `Response.json()`
 * (toujours UTF-8) déformerait sur tout caractère accentué.
 */
async function readBody(response: Response): Promise<string> {
  const charset = /charset=([^;]+)/i.exec(response.headers.get('content-type') ?? '')?.[1];
  const buffer = await response.arrayBuffer();
  const encoding = charset?.trim().toLowerCase() === 'iso-8859-1' ? 'latin1' : 'utf-8';
  return new TextDecoder(encoding).decode(buffer);
}

/**
 * Provider produit `dvd` principal (voir docs/DECISIONS.md) — compte prépayé
 * par clé, sans limite de débit ni quota par IP en production, contrairement
 * à UPCitemdb. Activé par `DVD_PRODUCT_PROVIDER=digiteyes`.
 *
 * Sécurité : ni `DIGITEYES_APP_KEY`, ni `DIGITEYES_AUTH_KEY`, ni la signature,
 * ni l'URL signée ne sont jamais journalisés — uniquement statut HTTP, code
 * de retour Digit-Eyes et longueur du barcode.
 */
@Injectable()
export class DigitEyesProvider implements DvdProductProvider {
  readonly id = 'digiteyes' as const;
  private readonly logger = new Logger(DigitEyesProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async lookup(barcode: string): Promise<DvdProductLookupOutcome> {
    // `trim()` : une espace copiée avec la clé fausserait la signature.
    const appKey = this.configService.get<string>('DIGITEYES_APP_KEY')?.trim();
    const authKey = this.configService.get<string>('DIGITEYES_AUTH_KEY')?.trim();
    if (!appKey || !authKey) {
      throw new BarcodeProviderError(
        this.id,
        'Identifiants Digit-Eyes absents (DIGITEYES_APP_KEY/DIGITEYES_AUTH_KEY).',
        undefined,
        'auth',
      );
    }
    const budgetMs = positiveMsOrDefault(
      this.configService.get<string | number>('DIGITEYES_TIMEOUT_BUDGET_MS'),
      DEFAULT_TIMEOUT_BUDGET_MS,
    );

    const query = new URLSearchParams({
      upc_code: barcode,
      app_key: appKey,
      signature: signDigitEyesRequest(barcode, authKey),
      language: 'en',
      field_names: FIELD_NAMES,
    });
    const response = await this.fetchWithRetry(
      `${ENDPOINT}?${query.toString()}`,
      budgetMs,
      barcode,
    );

    let body: DigitEyesResponse | null = null;
    try {
      const parsed: unknown = JSON.parse(response.text);
      if (parsed && typeof parsed === 'object') body = parsed as DigitEyesResponse;
    } catch {
      // Corps non JSON (page HTML d'un gateway…) : classé ci-dessous.
    }
    if (response.ok && !body) {
      throw new BarcodeProviderError(
        this.id,
        'Réponse Digit-Eyes illisible.',
        undefined,
        'invalid_response',
      );
    }

    const returnCode = body?.return_code != null ? String(body.return_code) : null;
    const failure = classifyDigitEyesFailure(response.status, returnCode, body !== null);
    if (failure?.outcome === 'error') {
      this.logger.warn(
        `Réponse HTTP ${response.status} (code ${returnCode ?? '—'}, ${failure.kind}, barcode masqué, longueur ${barcode.length})`,
      );
      throw new BarcodeProviderError(
        this.id,
        `Digit-Eyes a répondu ${response.status}${returnCode ? ` (code ${returnCode})` : ''}.`,
        undefined,
        failure.kind,
      );
    }
    if (failure?.outcome === 'no_match' || !body) return { status: 'no_match' };

    return normalizeDigitEyesProduct(body, barcode);
  }

  /** Même principe budget-total que `UpcItemDbProvider.fetchWithRetry`, sans
   * rate limiter (aucune limite de débit Digit-Eyes en production). Le corps
   * est lu AVANT de lever le délai : un serveur qui envoie les en-têtes puis
   * bloque le corps ne peut jamais dépasser le budget. Ne journalise jamais
   * `url` (elle porte `app_key` et la signature). */
  private async fetchWithRetry(
    url: string,
    budgetMs: number,
    barcode: string,
  ): Promise<FetchedResponse> {
    const deadline = Date.now() + budgetMs;
    let lastError: unknown;
    let lastResponse: FetchedResponse | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const attemptsRemaining = MAX_ATTEMPTS - attempt + 1;
      const remainingBudgetMs = deadline - Date.now();
      if (remainingBudgetMs <= 0) break;

      const timeoutMs = Math.min(
        Math.max(MIN_ATTEMPT_TIMEOUT_MS, Math.floor(remainingBudgetMs / attemptsRemaining)),
        remainingBudgetMs,
      );
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        const fetched: FetchedResponse = {
          status: response.status,
          ok: response.ok,
          text: await readBody(response),
        };
        if (!RETRYABLE_HTTP_STATUSES.has(fetched.status)) return fetched;
        lastResponse = fetched;
        this.logger.warn(
          `tentative ${attempt}/${MAX_ATTEMPTS} échouée (HTTP ${fetched.status}, barcode masqué, longueur ${barcode.length})`,
        );
      } catch (error) {
        lastError = error;
        const cause =
          error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'erreur réseau';
        this.logger.warn(
          `tentative ${attempt}/${MAX_ATTEMPTS} échouée (${cause}, barcode masqué, longueur ${barcode.length})`,
        );
      } finally {
        clearTimeout(timeout);
      }
    }

    if (lastResponse) return lastResponse;
    const timedOut =
      lastError === undefined || (lastError instanceof Error && lastError.name === 'AbortError');
    throw new BarcodeProviderError(
      this.id,
      timedOut ? 'Digit-Eyes : délai dépassé.' : 'Digit-Eyes injoignable.',
      // Jamais l'erreur brute de `fetch` : certaines implémentations y
      // recopient l'URL (donc la clé et la signature).
      undefined,
      timedOut ? 'timeout' : 'unavailable',
    );
  }
}
