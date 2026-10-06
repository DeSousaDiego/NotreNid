import { detectMediaType, hasVideoCategory } from './dvd-product-classification';
import {
  DIGITEYES_CHEERIOS,
  DIGITEYES_DARK_KNIGHT_TRILOGY,
  DIGITEYES_NINE_BLURAY,
  DIGITEYES_PIRATES,
} from './test-fixtures/digiteyes';

function categoriesOf(raw: string | null | undefined): string[] {
  return (raw ?? '').split(',').map((c) => c.trim());
}

describe('hasVideoCategory', () => {
  it.each([
    ['9', DIGITEYES_NINE_BLURAY],
    ['Dark Knight Trilogy', DIGITEYES_DARK_KNIGHT_TRILOGY],
    ['Pirates', DIGITEYES_PIRATES],
  ])('recognizes the real Digit-Eyes categories of %s as video', (_label, fixture) => {
    expect(hasVideoCategory(categoriesOf(fixture.response.categories))).toBe(true);
  });

  it('rejects the real Cheerios categories (food only)', () => {
    expect(hasVideoCategory(categoriesOf(DIGITEYES_CHEERIOS.response.categories))).toBe(false);
  });

  it('matches whole normalized entries only — never a substring (no accidental false positive)', () => {
    expect(
      hasVideoCategory([
        'Movie Theater Popcorn',
        'DVD Shaped Cookies',
        'Snacks For Movies Night',
        'Movies Music & Books',
      ]),
    ).toBe(false);
    expect(hasVideoCategory(['  movies  &  tv shows '])).toBe(true);
  });

  it('ignores bare department labels shared with players, storage or blank media', () => {
    expect(hasVideoCategory(['Movies', 'DVD', 'Blu-ray', 'Blu-ray HD DVD'])).toBe(false);
  });

  it('returns false for no categories at all', () => {
    expect(hasVideoCategory([])).toBe(false);
  });
});

describe('detectMediaType vs categories', () => {
  it('would wrongly yield "dvd" if applied to a Blu-ray-only category list — why categories never decide the format', () => {
    // "Blu-ray HD DVD" est une catégorie générique de revendeur, observée sur
    // des Blu-ray purs.
    expect(detectMediaType('Blu-ray HD DVD, Blu-ray Movies')).toBe('dvd');
  });
});
