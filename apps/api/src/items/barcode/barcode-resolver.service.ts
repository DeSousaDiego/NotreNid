import { Injectable } from '@nestjs/common';

import { BookBarcodeResolverService } from './book-barcode-resolver.service';
import { CdBarcodeResolverService } from './cd-barcode-resolver.service';
import type { ResolveBarcodeDto } from './dto/resolve-barcode.dto';
import { DvdBarcodeResolverService } from './dvd-barcode-resolver.service';
import type { BarcodeResolveResponse } from './types/barcode-result.types';

/**
 * Point d'entrée unique, indépendant de la catégorie — dispatch vers le
 * resolver spécialisé. Les trois catégories de `BARCODE_CATEGORIES`
 * (`barcode-category.type.ts`) ont désormais chacune leur resolver ; le
 * repli `unsupported` en fin de méthode reste néanmoins volontaire — défense
 * en profondeur si une future catégorie était ajoutée à ce tableau sans
 * qu'un `case` correspondant soit câblé ici, jamais un plantage silencieux.
 */
@Injectable()
export class BarcodeResolverService {
  constructor(
    private readonly bookResolver: BookBarcodeResolverService,
    private readonly cdResolver: CdBarcodeResolverService,
    private readonly dvdResolver: DvdBarcodeResolverService,
  ) {}

  async resolve(dto: ResolveBarcodeDto): Promise<BarcodeResolveResponse> {
    if (dto.category === 'book') {
      return this.bookResolver.resolve(dto.barcode);
    }

    if (dto.category === 'cd') {
      return this.cdResolver.resolve(dto.barcode);
    }

    if (dto.category === 'dvd') {
      return this.dvdResolver.resolve(dto.barcode);
    }

    return {
      barcode: dto.barcode,
      category: dto.category,
      status: 'unsupported',
      match: false,
      source: null,
      data: null,
      cover: null,
    };
  }
}
