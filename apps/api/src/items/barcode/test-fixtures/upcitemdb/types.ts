/**
 * Forme brute d'une réponse `GET https://api.upcitemdb.com/prod/trial/lookup`
 * (voir `UpcItemDbProvider`, dont ce type reprend volontairement les mêmes
 * champs) — TEST-ONLY, jamais importé par le code runtime.
 */
export interface RawUpcItemDbItemFixture {
  upc?: string;
  ean?: string;
  title?: string;
  description?: string;
  brand?: string;
  category?: string;
  images?: string[];
  offers?: Array<{ title?: string }>;
}

export interface RawUpcItemDbResponseFixture {
  code: string;
  total?: number;
  offset?: number;
  items: RawUpcItemDbItemFixture[];
}
