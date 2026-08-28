import { ItemCondition } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateItemDto } from './create-item.dto';

const BASE = {
  categoryId: '11111111-1111-4111-8111-111111111111',
  title: 'Dune',
  condition: ItemCondition.GOOD,
  ownerIds: ['22222222-2222-4222-8222-222222222222'],
};

async function validateRating(rating: unknown) {
  const dto = plainToInstance(CreateItemDto, { ...BASE, rating });
  const errors = await validate(dto);
  return errors.filter((error) => error.property === 'rating');
}

describe('CreateItemDto — rating', () => {
  it('accepts every half-star value from 0.5 to 5', async () => {
    for (const value of [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]) {
      expect(await validateRating(value)).toHaveLength(0);
    }
  });

  it('accepts an absent rating (no note)', async () => {
    expect(await validateRating(undefined)).toHaveLength(0);
  });

  it('rejects a value not on the half-star grid', async () => {
    expect(await validateRating(3.7)).not.toHaveLength(0);
  });

  it('rejects a negative value', async () => {
    expect(await validateRating(-1)).not.toHaveLength(0);
  });

  it('rejects a value above 5', async () => {
    expect(await validateRating(5.5)).not.toHaveLength(0);
  });

  it('rejects zero (use absent/null for "no rating", not 0)', async () => {
    expect(await validateRating(0)).not.toHaveLength(0);
  });
});
