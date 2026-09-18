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
    },
  },
  cover: { url: 'https://example.test/cover.jpg' },
};

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
      },
    });
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
      data: { title: null, description: null, book: MATCHED.data!.book },
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
        },
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
        },
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
