import { formatBookFormatLabel } from './metadataFields';

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
