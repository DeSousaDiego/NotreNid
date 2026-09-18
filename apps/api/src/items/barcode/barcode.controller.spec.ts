import { GUARDS_METADATA } from '@nestjs/common/constants';

import type { BarcodeResolverService } from './barcode-resolver.service';
import { BarcodeController } from './barcode.controller';
import type { ResolveBarcodeDto } from './dto/resolve-barcode.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

describe('BarcodeController', () => {
  it('delegates resolution to BarcodeResolverService with the validated DTO', async () => {
    const response = {
      barcode: '9782070368228',
      category: 'book',
      status: 'matched',
      match: true,
      source: 'google-books',
      data: null,
      cover: null,
    };
    const resolve = jest.fn().mockResolvedValue(response);
    const controller = new BarcodeController({ resolve } as unknown as BarcodeResolverService);
    const dto: ResolveBarcodeDto = { barcode: '9782070368228', category: 'book' };

    const result = await controller.resolve(dto);

    expect(resolve).toHaveBeenCalledWith(dto);
    expect(result).toBe(response);
  });

  it('is protected by JwtAuthGuard — no householdId to check, so no HouseholdMembershipGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, BarcodeController) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
  });
});
