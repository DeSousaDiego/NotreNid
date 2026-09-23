import type {
  BookMetadata,
  CdMetadata,
  DvdMetadata,
  Item,
  ItemCondition,
  ItemRating,
  ItemsQueryParams,
  PaginatedResult,
} from '@notre-nid/shared';

import type { HttpClient } from '../http';

export type MetadataInput<T> = Partial<Omit<T, 'itemId'>>;

export interface ItemInput {
  categoryId: string;
  title: string;
  /**
   * Code-barres produit (EAN-8/13, UPC-A/E, futurs formats). Jamais unique.
   * `null` explicite (distinct d'une propriété absente) efface un code-barres
   * existant lors d'une modification (`ItemsService.update`) ; une propriété
   * absente laisse la valeur actuelle inchangée.
   */
  barcode?: string | null;
  condition: ItemCondition;
  rating?: ItemRating;
  description?: string;
  notes?: string;
  coverImageUrl?: string;
  ownerIds: string[];
  /** Codes pays ISO 3166-1 alpha-2. Absent = ne pas modifier ; tableau vide = aucun pays. */
  countryCodes?: string[];
  book?: MetadataInput<BookMetadata>;
  cd?: MetadataInput<CdMetadata>;
  dvd?: MetadataInput<DvdMetadata>;
  customMetadata?: Record<string, unknown>;
}

export type CreateItemInput = ItemInput;
export type UpdateItemInput = Partial<ItemInput>;

export type BarcodeCategory = 'book' | 'cd' | 'dvd';

export interface ResolveBarcodeInput {
  barcode: string;
  category: BarcodeCategory;
}

/**
 * `matched` : au moins un fournisseur a renvoyé un résultat exploitable.
 * `partial` : propre à `dvd` — le produit physique a été identifié
 * (UPCitemdb) mais le FILM ne l'a pas été avec assez de confiance (recherche
 * TMDB sans candidat suffisant — y compris un coffret multi-films jamais
 * forcé vers un seul titre — ou panne technique TMDB non bloquante).
 * `data.dvd` ne contient alors que les champs fiables issus d'UPCitemdb
 * (`edition`/`region`/`format`), `director`/`releaseYear`/`duration` restant
 * `null`. Jamais utilisé pour `book`/`cd`. Voir docs/DECISIONS.md.
 * `no_match` : recherche aboutie, sans résultat — pas une erreur.
 * `unsupported` : catégorie pas encore implémentée côté API.
 * `provider_error` : tous les fournisseurs externes ont échoué techniquement.
 */
export type BarcodeResolveStatus =
  'matched' | 'partial' | 'no_match' | 'unsupported' | 'provider_error';

export interface BarcodeBookResult {
  author: string | null;
  isbn: string | null;
  publisher: string | null;
  publicationYear: number | null;
  language: string | null;
  pageCount: number | null;
  /** Format physique de l'édition (ex. "Hardcover", "Mass Market Paperback"),
   * texte brut du fournisseur, non normalisé. */
  format: string | null;
}

export interface BarcodeCdResult {
  artist: string | null;
  releaseYear: number | null;
  label: string | null;
  /** Type de boîtier/packaging (ex. "Jewel Case", "Digipak"), pas le support
   * (CD, 2×CD…) — déjà connu via la catégorie. Voir docs/DECISIONS.md. */
  format: string | null;
  /** Code pays ISO 3166-1 alpha-2 de l'ARTISTE principal (ex. "US"), jamais du
   * pays de distribution de cette édition — une notion différente. `null` dès
   * qu'il existe le moindre doute sur l'identité de l'artiste principal
   * (plusieurs artist-credit, "Various Artists") plutôt qu'une valeur devinée.
   * Voir docs/DECISIONS.md. */
  artistCountry: string | null;
}

/** `director`/`releaseYear`/`duration` proviennent EXCLUSIVEMENT de TMDB
 * (`null` en `status: 'partial'`, TMDB n'ayant pas résolu de film) ;
 * `edition`/`region`/`format` proviennent EXCLUSIVEMENT d'UPCitemdb
 * (renseignés dès `status: 'partial'`, dès qu'un produit vidéo physique a
 * été identifié) — jamais l'un à la place de l'autre. Voir docs/DECISIONS.md. */
export interface BarcodeDvdResult {
  director: string | null;
  releaseYear: number | null;
  duration: number | null;
  /** UPCitemdb uniquement (ex. "Collector's Edition") — jamais TMDB. */
  edition: string | null;
  /** UPCitemdb uniquement (ex. "Region 1", "Region Free") — jamais TMDB. */
  region: string | null;
  /** Type de boîtier/packaging UPCitemdb uniquement (ex. "Three-Disc") —
   * jamais TMDB, jamais le support (DVD/Blu-ray, déjà la catégorie). */
  format: string | null;
}

export interface ResolveBarcodeResult {
  barcode: string;
  category: BarcodeCategory;
  status: BarcodeResolveStatus;
  match: boolean;
  source: 'google-books' | 'open-library' | 'musicbrainz' | 'upcitemdb' | null;
  data: {
    title: string | null;
    description: string | null;
    book: BarcodeBookResult | null;
    cd: BarcodeCdResult | null;
    dvd: BarcodeDvdResult | null;
    /** Codes pays ISO 3166-1 alpha-2 — pour l'instant renseigné UNIQUEMENT
     * pour `dvd` (pays de production du film, TMDB), toujours `null` pour
     * `book`/`cd` (voir `BarcodeCdResult.artistCountry` pour le pays de
     * l'artiste CD, un champ distinct et non concerné ici). */
    countryCodes: string[] | null;
  } | null;
  cover: { url: string } | null;
}

export function createItemsEndpoints(http: HttpClient) {
  return {
    list: (householdId: string, query: ItemsQueryParams = {}) =>
      http.request<PaginatedResult<Item>>(`/households/${householdId}/items`, {
        query: {
          search: query.search,
          categoryId: query.categoryId,
          ownerId: query.ownerId,
          condition: query.condition,
          archived: query.archived,
          createdById: query.createdById,
          sort: query.sort,
          order: query.order,
          page: query.page,
          pageSize: query.pageSize,
        },
      }),

    get: (householdId: string, itemId: string) =>
      http.request<Item>(`/households/${householdId}/items/${itemId}`),

    create: (householdId: string, input: CreateItemInput) =>
      http.request<Item>(`/households/${householdId}/items`, { method: 'POST', body: input }),

    update: (householdId: string, itemId: string, input: UpdateItemInput) =>
      http.request<Item>(`/households/${householdId}/items/${itemId}`, {
        method: 'PATCH',
        body: input,
      }),

    archive: (householdId: string, itemId: string) =>
      http.request<Item>(`/households/${householdId}/items/${itemId}`, { method: 'DELETE' }),

    restore: (householdId: string, itemId: string) =>
      http.request<Item>(`/households/${householdId}/items/${itemId}/restore`, {
        method: 'POST',
      }),

    /** Ne crée ni ne modifie jamais d'item — recherche externe en lecture seule. */
    resolveBarcode: (input: ResolveBarcodeInput) =>
      http.request<ResolveBarcodeResult>('/items/barcode/resolve', {
        method: 'POST',
        body: input,
      }),
  };
}
