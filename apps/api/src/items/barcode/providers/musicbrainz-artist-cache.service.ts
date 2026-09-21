import { Injectable } from '@nestjs/common';

interface CacheEntry {
  value: string | null;
  expiresAt: number;
}

// Le pays d'un artiste ne change pour ainsi dire jamais — même principe que
// `MATCH_TTL_MS` (30 jours) dans `CdBarcodeResolverService`. Une seule durée
// pour un pays trouvé ET pour une absence confirmée (`null`) : les deux sont
// également peu susceptibles de changer d'ici là, pas besoin de la distinction
// à deux TTL que fait `BarcodeCacheService` entre `matched`/`no_match`.
const ARTIST_COUNTRY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Cache mémoire process-local dédié à `GET /ws/2/artist/{mbid}` (résolution du
 * pays de l'artiste principal, voir `MusicBrainzProvider`), volontairement
 * séparé de `BarcodeCacheService` : une clé (MBID d'artiste) et une valeur (un
 * pays optionnel) de nature différente de `category:barcode` → `BarcodeResolveResponse`,
 * et une durée de vie qui n'a pas de raison d'être couplée à celle d'un
 * résultat de scan CD. Permet d'éviter un second appel artiste lorsque
 * plusieurs CD du MÊME artiste sont scannés (le cache barcode, lui, ne
 * protège que les scans répétés du MÊME code-barres).
 *
 * Mêmes limites connues que `BarcodeCacheService`, pour les mêmes raisons
 * (voir ce fichier) : perdu à chaque redémarrage/redéploiement, non partagé
 * entre plusieurs instances Render, jamais nettoyé activement (volume attendu
 * négligeable — un artiste par CD réellement scanné).
 *
 * Ne met en cache qu'une résolution RÉUSSIE (pays trouvé, ou son absence
 * confirmée par une réponse 200 sans `country`/`area` exploitable) — jamais un
 * échec technique (timeout, HTTP non-ok, JSON illisible), qui reste transitoire
 * par nature : même principe que `CdBarcodeResolverService`, qui ne met jamais
 * en cache un `provider_error` (voir `MusicBrainzProvider.fetchArtistCountrySafely`,
 * seul appelant de `set`).
 */
@Injectable()
export class MusicBrainzArtistCacheService {
  private readonly entries = new Map<string, CacheEntry>();

  get(artistMbid: string): string | null | undefined {
    const entry = this.entries.get(artistMbid);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(artistMbid);
      return undefined;
    }
    return entry.value;
  }

  set(artistMbid: string, value: string | null): void {
    this.entries.set(artistMbid, { value, expiresAt: Date.now() + ARTIST_COUNTRY_TTL_MS });
  }
}
