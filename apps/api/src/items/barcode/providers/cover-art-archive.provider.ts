import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CoverArtImage {
  image?: string;
  /** `large`/`small` sont dépréciées par Cover Art Archive au profit des clés
   * numériques (`large` ≡ `500`, `small` ≡ `250`) — voir docs/DECISIONS.md.
   * Les deux formes sont gardées ici en repli pour une réponse plus ancienne
   * qui n'exposerait pas encore les clés numériques. */
  thumbnails?: { '500'?: string; large?: string; '250'?: string; small?: string };
  front?: boolean;
}

interface CoverArtResponse {
  images?: CoverArtImage[];
}

const DEFAULT_TIMEOUT_MS = 4000;

const INSECURE_CAA_PREFIX = 'http://coverartarchive.org/';

/**
 * Les `index.json` anciens de Cover Art Archive exposent encore des URLs en
 * `http://` (observé réellement le 2026-10-06, ex. release
 * e69e2f55-a2c0-472e-b30b-f43b565b3fbe : `image`/`thumbnails.large` en
 * `http://`, sans clé `500`), alors que les plus récents sont en `https://`.
 * Android bloque le trafic en clair dans un build release : l'image ne
 * s'affiche alors jamais côté mobile. Le même chemin en `https://` est servi
 * à l'identique (vérifié : 200 après redirection archive.org) — seul l'hôte
 * `coverartarchive.org` est réécrit, jamais une URL tierce.
 */
export function toSecureCoverUrl(url: string): string {
  return url.startsWith(INSECURE_CAA_PREFIX) ? `https://${url.slice('http://'.length)}` : url;
}

/**
 * Enrichissement non bloquant : une couverture absente ou une panne de ce
 * service ne doit **jamais** faire échouer une résolution CD par ailleurs
 * valide (voir docs/DECISIONS.md) — c'est pourquoi cette classe n'expose
 * aucune méthode qui lève : `fetchFrontCoverUrl` avale systématiquement ses
 * propres erreurs et renvoie `null`, jamais une `BarcodeProviderError`.
 * N'implémente pas `CdBarcodeProvider` : son contrat (une URL optionnelle, pas
 * un résultat de recherche complet) diffère trop pour partager l'interface.
 *
 * Pas de limite de débit ici, contrairement à `MusicBrainzProvider` :
 * coverartarchive.org documente explicitement l'absence de limite de débit
 * actuelle (voir docs/DECISIONS.md, sources consultées) — un hôte distinct de
 * musicbrainz.org, donc hors du périmètre de `MusicBrainzRateLimiterService`.
 */
@Injectable()
export class CoverArtArchiveProvider {
  private readonly logger = new Logger(CoverArtArchiveProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async fetchFrontCoverUrl(releaseMbid: string): Promise<string | null> {
    const timeoutMs =
      this.configService.get<number>('COVER_ART_ARCHIVE_TIMEOUT_MS') ?? DEFAULT_TIMEOUT_MS;
    const url = `https://coverartarchive.org/release/${encodeURIComponent(releaseMbid)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });

      // 404 = pas de couverture désignée pour cette release — un résultat CD
      // valide sans couverture, jamais une erreur (voir docs/DECISIONS.md).
      if (!response.ok) {
        if (response.status !== 404) {
          this.logger.warn(`Réponse HTTP ${response.status} — couverture ignorée`);
        }
        return null;
      }

      const body = (await response.json()) as CoverArtResponse;
      const front = body.images?.find((image) => image.front === true) ?? body.images?.[0];
      const coverUrl =
        front?.thumbnails?.['500'] ?? front?.thumbnails?.large ?? front?.image ?? null;
      return coverUrl ? toSecureCoverUrl(coverUrl) : null;
    } catch (error) {
      this.logger.warn(
        `Échec réseau ou timeout — couverture ignorée (${
          error instanceof Error ? error.message : 'erreur inconnue'
        })`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
