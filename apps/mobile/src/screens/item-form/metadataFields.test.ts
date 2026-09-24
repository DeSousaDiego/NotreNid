import {
  BOOK_FIELDS,
  CD_FIELDS,
  DVD_FIELDS,
  formatBookFormatLabel,
  humanizeMetadataKey,
  metadataDisplayRows,
} from './metadataFields';

describe('formatBookFormatLabel', () => {
  it('translates Hardcover to Relié', () => {
    expect(formatBookFormatLabel('Hardcover')).toBe('Relié');
  });

  it('translates Paperback and Trade Paperback to Broché', () => {
    expect(formatBookFormatLabel('Paperback')).toBe('Broché');
    expect(formatBookFormatLabel('Trade Paperback')).toBe('Broché');
  });

  it('translates Mass Market Paperback to Poche', () => {
    expect(formatBookFormatLabel('Mass Market Paperback')).toBe('Poche');
  });

  it('is case-insensitive and trims surrounding whitespace', () => {
    expect(formatBookFormatLabel('  hardcover  ')).toBe('Relié');
    expect(formatBookFormatLabel('HARDCOVER')).toBe('Relié');
  });

  it('falls back to the raw value for an unrecognized format, never hiding or mistranslating it', () => {
    expect(formatBookFormatLabel('Spiral-bound')).toBe('Spiral-bound');
    expect(formatBookFormatLabel('Library Binding')).toBe('Library Binding');
  });
});

describe('metadataDisplayRows', () => {
  it('orders book rows exactly as BOOK_FIELDS (the same order the form edits them in), with the pre-existing detail labels', () => {
    const rows = metadataDisplayRows(BOOK_FIELDS, {
      itemId: 'item-1',
      author: 'Frank Herbert',
      isbn: '9782070368228',
      publisher: 'Gallimard',
      publicationYear: 1965,
      language: 'fr',
      pageCount: 592,
      format: 'Hardcover',
    });

    expect(rows).toEqual([
      { label: 'Auteur', value: 'Frank Herbert' },
      { label: 'ISBN', value: '9782070368228' },
      { label: 'Éditeur', value: 'Gallimard' },
      // « Année », pas « Année de publication » (libellé du formulaire) : le
      // libellé déjà affiché en fiche détail avant ce refactor est conservé
      // via `detailLabel`.
      { label: 'Année', value: '1965' },
      { label: 'Langue', value: 'fr' },
      { label: 'Pages', value: '592' },
      // Traduit, comme avant ce refactor (jamais pour CD/DVD, voir plus bas).
      { label: 'Format', value: 'Relié' },
    ]);
  });

  it('omits a field entirely when its value is null, empty, or falsy (0) — never a placeholder row', () => {
    const rows = metadataDisplayRows(BOOK_FIELDS, {
      itemId: 'item-1',
      author: 'Frank Herbert',
      isbn: null,
      publisher: null,
      publicationYear: 0,
      language: '',
      pageCount: null,
      format: null,
    });

    expect(rows).toEqual([{ label: 'Auteur', value: 'Frank Herbert' }]);
  });

  it('never translates a CD format — the raw provider value is shown as-is', () => {
    const rows = metadataDisplayRows(CD_FIELDS, {
      itemId: 'item-1',
      artist: 'Daft Punk',
      releaseYear: 2001,
      label: 'Daft Life',
      format: 'Jewel Case',
    });

    expect(rows).toEqual([
      { label: 'Artiste', value: 'Daft Punk' },
      { label: 'Année', value: '2001' },
      { label: 'Label', value: 'Daft Life' },
      { label: 'Format', value: 'Jewel Case' },
    ]);
  });

  it('never translates a DVD format either, and appends "min" only to the duration', () => {
    const rows = metadataDisplayRows(DVD_FIELDS, {
      itemId: 'item-1',
      director: 'Christopher Nolan',
      releaseYear: 2008,
      edition: 'Édition Collector',
      region: 'Zone 2',
      format: 'Blu-ray',
      durationMinutes: 152,
    });

    expect(rows).toEqual([
      { label: 'Réalisateur', value: 'Christopher Nolan' },
      { label: 'Année', value: '2008' },
      { label: 'Édition', value: 'Édition Collector' },
      { label: 'Région', value: 'Zone 2' },
      { label: 'Format', value: 'Blu-ray' },
      { label: 'Durée', value: '152 min' },
    ]);
  });
});

describe('humanizeMetadataKey', () => {
  it('splits camelCase into words, capitalizing only the first', () => {
    expect(humanizeMetadataKey('releaseFormat')).toBe('Release format');
    expect(humanizeMetadataKey('specialEdition')).toBe('Special edition');
  });

  it('splits snake_case into words', () => {
    expect(humanizeMetadataKey('purchase_date')).toBe('Purchase date');
  });

  it('splits kebab-case into words', () => {
    expect(humanizeMetadataKey('purchase-date')).toBe('Purchase date');
  });

  it('leaves an already-plain key capitalized, unchanged otherwise', () => {
    expect(humanizeMetadataKey('edition')).toBe('Edition');
  });
});
