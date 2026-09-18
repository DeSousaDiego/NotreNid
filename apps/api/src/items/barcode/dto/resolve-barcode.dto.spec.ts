import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ResolveBarcodeDto } from './resolve-barcode.dto';

async function validateDto(overrides: Record<string, unknown>) {
  const dto = plainToInstance(ResolveBarcodeDto, {
    barcode: '9782070368228',
    category: 'book',
    ...overrides,
  });
  return validate(dto);
}

describe('ResolveBarcodeDto — barcode', () => {
  it('accepts an EAN-13', async () => {
    expect(await validateDto({ barcode: '9782070368228' })).toHaveLength(0);
  });

  it('accepts a UPC-A (12 digits)', async () => {
    expect(await validateDto({ barcode: '036000291452' })).toHaveLength(0);
  });

  it('accepts an EAN-8', async () => {
    expect(await validateDto({ barcode: '96385074' })).toHaveLength(0);
  });

  it('trims surrounding whitespace before validating', async () => {
    const dto = plainToInstance(ResolveBarcodeDto, {
      barcode: '  9782070368228  ',
      category: 'book',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.barcode).toBe('9782070368228');
  });

  it('rejects a barcode containing letters', async () => {
    const errors = await validateDto({ barcode: '978207036822X' });
    expect(errors.some((error) => error.property === 'barcode')).toBe(true);
  });

  it('rejects a barcode with an unreasonable length (not 8, 12 or 13 digits)', async () => {
    expect((await validateDto({ barcode: '123' })).some((e) => e.property === 'barcode')).toBe(
      true,
    );
    expect(
      (await validateDto({ barcode: '12345678901234567890' })).some(
        (e) => e.property === 'barcode',
      ),
    ).toBe(true);
  });

  it('rejects an empty barcode', async () => {
    expect((await validateDto({ barcode: '' })).some((e) => e.property === 'barcode')).toBe(true);
  });

  it('rejects a barcode over the 32-character ceiling shared with Item.barcode', async () => {
    const errors = await validateDto({ barcode: '1'.repeat(40) });
    expect(errors.some((error) => error.property === 'barcode')).toBe(true);
  });
});

describe('ResolveBarcodeDto — category', () => {
  it('accepts book, cd and dvd', async () => {
    for (const category of ['book', 'cd', 'dvd']) {
      expect(await validateDto({ category })).toHaveLength(0);
    }
  });

  it('rejects an unknown category', async () => {
    const errors = await validateDto({ category: 'vinyl' });
    expect(errors.some((error) => error.property === 'category')).toBe(true);
  });

  it('rejects a missing category', async () => {
    const dto = plainToInstance(ResolveBarcodeDto, { barcode: '9782070368228' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'category')).toBe(true);
  });
});
