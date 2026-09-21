import { Injectable } from '@nestjs/common';

import {
  TmdbProvider,
  cleanTitleForSearch,
  extractYearHint,
  selectBestMovieMatch,
} from './providers/tmdb.provider';
import type { TmdbMovieResult, UpcItemDbPocResult } from './types/dvd-poc.types';

export type DvdEnrichmentOutcome =
  | { kind: 'resolved'; movie: TmdbMovieResult }
  /** Recherche TMDB effectuée (ou title de recherche vide) sans candidat
   * assez confiant — inclut le cas "coffret multi-films" (voir
   * docs/DECISIONS.md : jamais un cas spécial codé en dur, uniquement le
   * scoring/seuil habituel qui rejette naturellement un mauvais candidat
   * unique comme un documentaire portant un titre proche). Jamais un échec
   * technique. */
  | { kind: 'unresolved' }
  /** Panne technique TMDB (réseau, timeout, 429/5xx, JSON illisible) — voir
   * `DvdBarcodeResolverService` : ne devient JAMAIS un `provider_error`
   * global, le produit physique UPCitemdb reste exploitable. */
  | { kind: 'provider_error'; error: unknown };

/**
 * Orchestration UPCitemdb → TMDB — jamais l'inverse des responsabilités (voir
 * docs/DECISIONS.md : UPCitemdb reste la seule source pour l'édition
 * physique, TMDB la seule pour l'œuvre). Prend un résultat UPCitemdb DÉJÀ
 * validé comme vidéo (`mediaType !== 'unknown'`) — n'est jamais appelé pour un
 * produit non-vidéo, cette décision reste entièrement du ressort de
 * `UpcItemDbProvider`.
 */
@Injectable()
export class DvdEnrichmentService {
  constructor(private readonly tmdb: TmdbProvider) {}

  async enrich(upcResult: UpcItemDbPocResult): Promise<DvdEnrichmentOutcome> {
    const cleanedTitle = cleanTitleForSearch(upcResult.rawTitle ?? '');
    if (!cleanedTitle) return { kind: 'unresolved' };

    const yearHint = extractYearHint(upcResult.rawTitle ?? '');

    let results: Awaited<ReturnType<TmdbProvider['search']>>;
    try {
      results = await this.tmdb.search(cleanedTitle, yearHint);
    } catch (error) {
      return { kind: 'provider_error', error };
    }

    const selection = selectBestMovieMatch(results, cleanedTitle, yearHint);
    if (!selection) return { kind: 'unresolved' };

    try {
      const movie = await this.tmdb.getDetails(selection.id);
      return { kind: 'resolved', movie };
    } catch (error) {
      return { kind: 'provider_error', error };
    }
  }
}
