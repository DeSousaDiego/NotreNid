import { mockItem } from '../test-utils/mockItem';

import { creditLineForItem, ownersPhrase } from './itemSecondaryInfo';

const owner = (displayName: string) => ({ displayName });

describe('creditLineForItem', () => {
  it('joins the creator and the year with a middle dot', () => {
    const item = mockItem();
    const book = { ...item.book!, author: 'Albert Camus', publicationYear: 1942 };
    expect(creditLineForItem({ ...item, book })).toBe('Albert Camus · 1942');
  });

  it('shows only the part that is known', () => {
    const item = mockItem();
    expect(creditLineForItem({ ...item, book: { ...item.book!, publicationYear: null } })).toBe(
      item.book!.author,
    );
    expect(
      creditLineForItem({ ...item, book: { ...item.book!, author: null, publicationYear: 1942 } }),
    ).toBe('1942');
  });

  it('returns null when nothing is known (custom category)', () => {
    expect(creditLineForItem(mockItem({ book: null, cd: null, dvd: null }))).toBeNull();
  });
});

describe('ownersPhrase', () => {
  it('names one, two and three owners in plain French', () => {
    expect(ownersPhrase([owner('Julie')])).toBe('À Julie');
    expect(ownersPhrase([owner('Julie'), owner('Diego')])).toBe('À Julie et Diego');
    expect(ownersPhrase([owner('Julie'), owner('Diego'), owner('Sam')])).toBe(
      'À Julie, Diego et Sam',
    );
  });

  it('summarizes beyond three owners', () => {
    expect(
      ownersPhrase([owner('Julie'), owner('Diego'), owner('Sam'), owner('Lou'), owner('Max')]),
    ).toBe('À Julie, Diego et 3 autres');
  });

  it('returns null rather than a dangling « À » when no named owner remains', () => {
    expect(ownersPhrase([])).toBeNull();
    expect(ownersPhrase([owner('  ')])).toBeNull();
  });
});
