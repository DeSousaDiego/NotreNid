import type { ResolveBarcodeResult } from '@notre-nid/api-client';

import { buildDraftValuesFromBarcodeResult } from './barcodeResultMapping';

const MATCHED: ResolveBarcodeResult = {
  barcode: '9782070368228',
  category: 'book',
  status: 'matched',
  match: true,
  source: 'google-books',
  data: {
    title: 'Dune',
    description: "L'histoire de Paul Atréides.",
    book: {
      author: 'Frank Herbert',
      isbn: '9782070368228',
      publisher: 'Gallimard',
      publicationYear: 1970,
      language: 'fr',
      pageCount: 592,
      format: 'Hardcover',
    },
    cd: null,
  },
  cover: { url: 'https://example.test/cover.jpg' },
};

const MATCHED_CD: ResolveBarcodeResult = {
  barcode: '5099969236424',
  category: 'cd',
  status: 'matched',
  match: true,
  source: 'musicbrainz',
  data: {
    title: 'Discovery',
    description: null,
    book: null,
    // `format` représente le boîtier ("Jewel Case"), pas le support (CD) —
    // voir docs/DECISIONS.md.
    cd: {
      artist: 'Daft Punk',
      releaseYear: 2001,
      label: 'Daft Life',
      format: 'Jewel Case',
      artistCountry: 'FR',
    },
  },
  cover: { url: 'https://example.test/discovery-cover.jpg' },
};

describe('buildDraftValuesFromBarcodeResult — cd', () => {
  it('maps a full cd match into the expected draft shape, including countryCodes from a valid cd.artistCountry', () => {
    expect(buildDraftValuesFromBarcodeResult(MATCHED_CD)).toEqual({
      barcode: '5099969236424',
      title: 'Discovery',
      coverImageUrl: 'https://example.test/discovery-cover.jpg',
      metadata: {
        artist: 'Daft Punk',
        releaseYear: '2001',
        label: 'Daft Life',
        format: 'Jewel Case',
      },
      countryCodes: ['FR'],
    });
  });

  it('never prefills condition, rating, notes or ownerIds for a cd — personal-to-this-copy fields', () => {
    const values = buildDraftValuesFromBarcodeResult(MATCHED_CD);
    expect(values).not.toHaveProperty('condition');
    expect(values).not.toHaveProperty('rating');
    expect(values).not.toHaveProperty('notes');
    expect(values).not.toHaveProperty('ownerIds');
  });

  it('omits countryCodes entirely when cd.artistCountry is null — never an invented or empty country', () => {
    const result: ResolveBarcodeResult = {
      ...MATCHED_CD,
      data: {
        ...MATCHED_CD.data!,
        cd: { ...MATCHED_CD.data!.cd!, artistCountry: null },
      },
    };
    expect(buildDraftValuesFromBarcodeResult(result)).not.toHaveProperty('countryCodes');
  });

  it('omits countryCodes when cd.artistCountry is not a recognized ISO 3166-1 alpha-2 code — no crash, no invented value', () => {
    const result: ResolveBarcodeResult = {
      ...MATCHED_CD,
      data: {
        ...MATCHED_CD.data!,
        cd: { ...MATCHED_CD.data!.cd!, artistCountry: 'ZZ' },
      },
    };
    expect(() => buildDraftValuesFromBarcodeResult(result)).not.toThrow();
    expect(buildDraftValuesFromBarcodeResult(result)).not.toHaveProperty('countryCodes');
  });

  it('never overwrites an already-selected countryCodes when artistCountry is null or invalid — the key is simply absent from the merge patch', () => {
    // Reproduit la fusion superficielle de `AddItemDraftContext.setValues`
    // (`{ ...prev, ...values }`) : une clé absente de `values` ne touche
    // jamais la valeur déjà présente dans `prev`.
    const previousDraftValues = { countryCodes: ['BE'] };
    const result: ResolveBarcodeResult = {
      ...MATCHED_CD,
      data: {
        ...MATCHED_CD.data!,
        cd: { ...MATCHED_CD.data!.cd!, artistCountry: null },
      },
    };

    const merged = { ...previousDraftValues, ...buildDraftValuesFromBarcodeResult(result) };

    expect(merged.countryCodes).toEqual(['BE']);
  });

  it('includes only the cd metadata fields MusicBrainz actually returned (partial mapping)', () => {
    const result: ResolveBarcodeResult = {
      ...MATCHED_CD,
      data: {
        title: 'Discovery',
        description: null,
        book: null,
        cd: {
          artist: 'Daft Punk',
          releaseYear: null,
          label: null,
          format: null,
          artistCountry: null,
        },
      },
    };
    expect(buildDraftValuesFromBarcodeResult(result).metadata).toEqual({ artist: 'Daft Punk' });
  });

  it('omits the cover entirely when MusicBrainz matched but Cover Art Archive had none', () => {
    const result: ResolveBarcodeResult = { ...MATCHED_CD, cover: null };
    expect(buildDraftValuesFromBarcodeResult(result)).not.toHaveProperty('coverImageUrl');
  });

  it('omits metadata entirely when no cd field is exploitable', () => {
    const result: ResolveBarcodeResult = {
      ...MATCHED_CD,
      data: {
        title: 'Discovery',
        description: null,
        book: null,
        cd: { artist: null, releaseYear: null, label: null, format: null, artistCountry: null },
      },
    };
    expect(buildDraftValuesFromBarcodeResult(result)).not.toHaveProperty('metadata');
  });
});

describe('buildDraftValuesFromBarcodeResult', () => {
  it('maps a full match into the expected draft shape', () => {
    expect(buildDraftValuesFromBarcodeResult(MATCHED)).toEqual({
      barcode: '9782070368228',
      title: 'Dune',
      description: "L'histoire de Paul Atréides.",
      coverImageUrl: 'https://example.test/cover.jpg',
      metadata: {
        author: 'Frank Herbert',
        isbn: '9782070368228',
        publisher: 'Gallimard',
        publicationYear: '1970',
        language: 'fr',
        pageCount: '592',
        format: 'Hardcover',
      },
    });
  });

  it('passes the physical format through as-is, never translating it at storage time', () => {
    const values = buildDraftValuesFromBarcodeResult(MATCHED);
    expect(values.metadata?.format).toBe('Hardcover');
  });

  it('always includes the barcode itself, even with no other data', () => {
    const result: ResolveBarcodeResult = { ...MATCHED, data: null, cover: null };
    expect(buildDraftValuesFromBarcodeResult(result)).toEqual({ barcode: '9782070368228' });
  });

  it('never prefills condition, rating, notes or ownerIds — personal-to-this-copy fields', () => {
    const values = buildDraftValuesFromBarcodeResult(MATCHED);
    expect(values).not.toHaveProperty('condition');
    expect(values).not.toHaveProperty('rating');
    expect(values).not.toHaveProperty('notes');
    expect(values).not.toHaveProperty('ownerIds');
  });

  it('omits title/description when absent, rather than sending an empty string', () => {
    const result: ResolveBarcodeResult = {
      ...MATCHED,
      data: { title: null, description: null, book: MATCHED.data!.book, cd: null },
    };
    const values = buildDraftValuesFromBarcodeResult(result);
    expect(values).not.toHaveProperty('title');
    expect(values).not.toHaveProperty('description');
  });

  it('omits the cover entirely when the provider did not return one', () => {
    const result: ResolveBarcodeResult = { ...MATCHED, cover: null };
    expect(buildDraftValuesFromBarcodeResult(result)).not.toHaveProperty('coverImageUrl');
  });

  it('omits metadata entirely when no book field is exploitable', () => {
    const result: ResolveBarcodeResult = {
      ...MATCHED,
      data: {
        title: 'Dune',
        description: null,
        book: {
          author: null,
          isbn: null,
          publisher: null,
          publicationYear: null,
          language: null,
          pageCount: null,
          format: null,
        },
        cd: null,
      },
    };
    expect(buildDraftValuesFromBarcodeResult(result)).not.toHaveProperty('metadata');
  });

  it('includes only the metadata fields the provider actually returned', () => {
    const result: ResolveBarcodeResult = {
      ...MATCHED,
      data: {
        title: 'Dune',
        description: null,
        book: {
          author: 'Frank Herbert',
          isbn: null,
          publisher: null,
          publicationYear: null,
          language: null,
          pageCount: null,
          format: null,
        },
        cd: null,
      },
    };
    expect(buildDraftValuesFromBarcodeResult(result).metadata).toEqual({ author: 'Frank Herbert' });
  });

  it('stringifies numeric fields for the text-based form schema', () => {
    const values = buildDraftValuesFromBarcodeResult(MATCHED);
    expect(values.metadata?.publicationYear).toBe('1970');
    expect(values.metadata?.pageCount).toBe('592');
  });
});
