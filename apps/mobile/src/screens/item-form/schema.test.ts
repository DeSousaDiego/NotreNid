import type { Category } from '@notre-nid/shared';

import { mockItem } from '../../test-utils/mockItem';

import {
  buildItemPayload,
  EMPTY_ITEM_FORM_VALUES,
  findMissingRequiredCustomFields,
  itemFormSchema,
  itemToFormValues,
  type ItemFormValues,
} from './schema';

const BOOK_CATEGORY: Category = {
  id: 'category-book',
  householdId: null,
  name: 'Livre',
  slug: 'book',
  icon: null,
  isSystem: true,
  metadataSchema: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const CD_CATEGORY: Category = { ...BOOK_CATEGORY, id: 'category-cd', slug: 'cd', name: 'CD' };
const DVD_CATEGORY: Category = { ...BOOK_CATEGORY, id: 'category-dvd', slug: 'dvd', name: 'DVD' };

const CUSTOM_CATEGORY: Category = {
  id: 'category-vinyl',
  householdId: 'household-1',
  name: 'Vinyles',
  slug: 'vinyles',
  icon: null,
  isSystem: false,
  metadataSchema: [
    { key: 'edition', label: 'Édition', type: 'string', required: true },
    { key: 'weight', label: 'Poids (g)', type: 'number' },
    { key: 'limited', label: 'Édition limitée', type: 'boolean' },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('itemFormSchema', () => {
  it('rejects a form missing a category, title, condition or owner', () => {
    const result = itemFormSchema.safeParse(EMPTY_ITEM_FORM_VALUES);
    expect(result.success).toBe(false);
  });

  it('accepts a minimal valid form', () => {
    const values: ItemFormValues = {
      ...EMPTY_ITEM_FORM_VALUES,
      categoryId: 'category-book',
      title: 'Dune',
      ownerIds: ['user-1'],
    };
    expect(itemFormSchema.safeParse(values).success).toBe(true);
  });

  const validBase: ItemFormValues = {
    ...EMPTY_ITEM_FORM_VALUES,
    categoryId: 'category-book',
    title: 'Dune',
    ownerIds: ['user-1'],
  };

  it('accepts every half-star rating from 0.5 to 5', () => {
    for (const rating of [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]) {
      expect(itemFormSchema.safeParse({ ...validBase, rating }).success).toBe(true);
    }
  });

  it('accepts a null or absent rating (no note)', () => {
    expect(itemFormSchema.safeParse({ ...validBase, rating: null }).success).toBe(true);
    expect(itemFormSchema.safeParse(validBase).success).toBe(true);
  });

  it('rejects a rating off the half-star grid', () => {
    expect(itemFormSchema.safeParse({ ...validBase, rating: 3.7 }).success).toBe(false);
  });

  it('rejects a rating outside the 0.5–5 range', () => {
    expect(itemFormSchema.safeParse({ ...validBase, rating: -1 }).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...validBase, rating: 5.5 }).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...validBase, rating: 0 }).success).toBe(false);
  });
});

describe('buildItemPayload', () => {
  const baseValues: ItemFormValues = {
    ...EMPTY_ITEM_FORM_VALUES,
    categoryId: 'category-book',
    title: '  Dune  ',
    condition: 'NEW',
    ownerIds: ['user-1', 'user-2'],
  };

  it('trims the title and omits blank optional fields', () => {
    const payload = buildItemPayload(baseValues, BOOK_CATEGORY);
    expect(payload.title).toBe('Dune');
    expect(payload.description).toBeUndefined();
    expect(payload.notes).toBeUndefined();
    expect(payload.coverImageUrl).toBeUndefined();
    expect(payload.rating).toBeUndefined();
  });

  it('passes a set rating through, and omits it when null (no note)', () => {
    expect(buildItemPayload({ ...baseValues, rating: 4.5 }, BOOK_CATEGORY).rating).toBe(4.5);
    expect(buildItemPayload({ ...baseValues, rating: null }, BOOK_CATEGORY).rating).toBeUndefined();
  });

  it('builds book metadata with numeric fields parsed and blanks dropped', () => {
    const values: ItemFormValues = {
      ...baseValues,
      metadata: { author: 'Frank Herbert', publicationYear: '1965', pageCount: '' },
    };
    const payload = buildItemPayload(values, BOOK_CATEGORY);
    expect(payload.book).toEqual({
      author: 'Frank Herbert',
      isbn: undefined,
      publisher: undefined,
      publicationYear: 1965,
      language: undefined,
      pageCount: undefined,
    });
    expect(payload.cd).toBeUndefined();
    expect(payload.dvd).toBeUndefined();
  });

  it('builds cd metadata for the cd category', () => {
    const values: ItemFormValues = {
      ...baseValues,
      categoryId: 'category-cd',
      metadata: { artist: 'Daft Punk', album: 'Discovery', releaseYear: '2001' },
    };
    const payload = buildItemPayload(values, CD_CATEGORY);
    expect(payload.cd).toEqual({
      artist: 'Daft Punk',
      album: 'Discovery',
      releaseYear: 2001,
      label: undefined,
      format: undefined,
    });
    expect(payload.book).toBeUndefined();
  });

  it('builds dvd metadata for the dvd category', () => {
    const values: ItemFormValues = {
      ...baseValues,
      categoryId: 'category-dvd',
      metadata: { director: 'Denis Villeneuve', durationMinutes: '155' },
    };
    const payload = buildItemPayload(values, DVD_CATEGORY);
    expect(payload.dvd).toMatchObject({ director: 'Denis Villeneuve', durationMinutes: 155 });
  });

  it('drops a non-numeric year/count instead of sending NaN', () => {
    const values: ItemFormValues = {
      ...baseValues,
      metadata: { publicationYear: 'not-a-year' },
    };
    const payload = buildItemPayload(values, BOOK_CATEGORY);
    expect(payload.book?.publicationYear).toBeUndefined();
  });

  it('builds customMetadata for a custom category, converting types per field schema', () => {
    const values: ItemFormValues = {
      ...baseValues,
      categoryId: 'category-vinyl',
      customMetadata: { edition: 'Collector', weight: '180', limited: 'true' },
    };
    const payload = buildItemPayload(values, CUSTOM_CATEGORY);
    expect(payload.customMetadata).toEqual({ edition: 'Collector', weight: 180, limited: true });
    expect(payload.book).toBeUndefined();
  });

  it('omits a custom field left blank', () => {
    const values: ItemFormValues = {
      ...baseValues,
      categoryId: 'category-vinyl',
      customMetadata: { edition: 'Collector', weight: '' },
    };
    const payload = buildItemPayload(values, CUSTOM_CATEGORY);
    expect(payload.customMetadata).toEqual({ edition: 'Collector' });
  });
});

describe('itemToFormValues', () => {
  it('maps an existing rated item back into form values', () => {
    const item = mockItem({ rating: 3.5 });
    expect(itemToFormValues(item).rating).toBe(3.5);
  });

  it('maps an existing book item back into form values', () => {
    const item = mockItem({
      book: {
        itemId: 'item-1',
        author: 'Victor Hugo',
        isbn: '123',
        publisher: 'Gallimard',
        publicationYear: 1862,
        language: 'fr',
        pageCount: 1900,
      },
    });

    const values = itemToFormValues(item);

    expect(values.categoryId).toBe(item.category.id);
    expect(values.ownerIds).toEqual(['user-1']);
    expect(values.metadata.author).toBe('Victor Hugo');
    expect(values.metadata.publicationYear).toBe('1862');
  });

  it('maps an existing custom-category item, stringifying every metadata value', () => {
    const item = mockItem({
      category: CUSTOM_CATEGORY,
      book: null,
      customMetadata: { edition: 'Collector', weight: 180, limited: true },
    });

    const values = itemToFormValues(item);

    expect(values.customMetadata).toEqual({
      edition: 'Collector',
      weight: '180',
      limited: 'true',
    });
  });
});

describe('findMissingRequiredCustomFields', () => {
  it('lists required fields left empty', () => {
    const missing = findMissingRequiredCustomFields(CUSTOM_CATEGORY, { weight: '180' });
    expect(missing).toEqual(['Édition']);
  });

  it('returns an empty list once the required field is filled', () => {
    const missing = findMissingRequiredCustomFields(CUSTOM_CATEGORY, { edition: 'Collector' });
    expect(missing).toEqual([]);
  });

  it('returns an empty list for system categories (no dynamic schema)', () => {
    expect(findMissingRequiredCustomFields(BOOK_CATEGORY, {})).toEqual([]);
  });
});
