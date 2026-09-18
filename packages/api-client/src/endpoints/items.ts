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
  /** Code-barres produit (EAN-8/13, UPC-A/E, futurs formats). Jamais unique. */
  barcode?: string;
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
 * `no_match` : recherche aboutie, sans résultat — pas une erreur.
 * `unsupported` : catégorie pas encore implémentée côté API (`cd`/`dvd`).
 * `provider_error` : tous les fournisseurs externes ont échoué techniquement.
 */
export type BarcodeResolveStatus = 'matched' | 'no_match' | 'unsupported' | 'provider_error';

export interface BarcodeBookResult {
  author: string | null;
  isbn: string | null;
  publisher: string | null;
  publicationYear: number | null;
  language: string | null;
  pageCount: number | null;
}

export interface ResolveBarcodeResult {
  barcode: string;
  category: BarcodeCategory;
  status: BarcodeResolveStatus;
  match: boolean;
  source: 'google-books' | 'open-library' | null;
  data: { title: string | null; description: string | null; book: BarcodeBookResult | null } | null;
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
