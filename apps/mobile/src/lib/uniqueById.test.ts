import { uniqueById } from './uniqueById';

describe('uniqueById', () => {
  it('keeps page order and drops an item repeated on a later page', () => {
    const pages = [
      [{ id: 'a' }, { id: 'b' }],
      [{ id: 'b' }, { id: 'c' }],
    ];
    expect(uniqueById(pages).map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty list for no pages', () => {
    expect(uniqueById([])).toEqual([]);
  });
});
