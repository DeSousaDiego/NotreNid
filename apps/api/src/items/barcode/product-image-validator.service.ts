import { isIP } from 'node:net';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { positiveMsOrDefault } from './barcode-config.util';

// Court par conception : vérifier une image ne doit jamais ralentir
// sensiblement un scan (la vérification tourne en parallèle de TMDB, voir
// `DvdBarcodeResolverService`).
const DEFAULT_TIMEOUT_MS = 1500;
// Certains CDN refusent HEAD : repli sur un GET d'un seul octet.
const HEAD_UNSUPPORTED_STATUSES = new Set([403, 405, 501]);

/**
 * Décide si l'image d'un fournisseur produit peut être exposée au mobile —
 * voir docs/DECISIONS.md. Observé au POC Digit-Eyes : URL HTTPS en 404,
 * domaine mort, URL `http://` (bloquée par Android en release). Règles :
 * HTTPS uniquement (jamais de réécriture d'une URL `http://` arbitraire),
 * réponse 2xx après redirections, destination finale toujours HTTPS, et
 * `Content-Type` image s'il est annoncé. Tout échec technique (timeout,
 * réseau, réponse inattendue) → `false` : jamais une exception, une image ne
 * fait jamais échouer une résolution.
 */
@Injectable()
export class ProductImageValidator {
  private readonly logger = new Logger(ProductImageValidator.name);

  constructor(private readonly configService: ConfigService) {}

  async isUsable(url: string | null): Promise<boolean> {
    if (!url) return false;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
    if (parsed.protocol !== 'https:') return false;
    // L'URL vient d'un fournisseur tiers : jamais de requête vers une IP
    // littérale ou localhost (sonde de réseau interne depuis l'API).
    const host = parsed.hostname.replace(/^\[|\]$/g, '');
    if (isIP(host) !== 0 || host === 'localhost' || host.endsWith('.localhost')) return false;

    const timeoutMs = positiveMsOrDefault(
      this.configService.get<string | number>('PRODUCT_IMAGE_CHECK_TIMEOUT_MS'),
      DEFAULT_TIMEOUT_MS,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let response = await fetch(parsed, { method: 'HEAD', signal: controller.signal });
      if (HEAD_UNSUPPORTED_STATUSES.has(response.status)) {
        response = await fetch(parsed, {
          method: 'GET',
          headers: { Range: 'bytes=0-0' },
          signal: controller.signal,
        });
        await response.body?.cancel();
      }

      const finalUrl = response.url || parsed.href;
      const contentType = response.headers.get('content-type');
      const usable =
        response.ok &&
        finalUrl.startsWith('https://') &&
        (contentType === null || contentType.toLowerCase().startsWith('image/'));
      if (!usable) {
        this.logger.debug(`Image fournisseur écartée (${parsed.host}, HTTP ${response.status})`);
      }
      return usable;
    } catch (error) {
      this.logger.debug(
        `Image fournisseur écartée (${parsed.host}, ${
          error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'erreur réseau'
        })`,
      );
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
}
