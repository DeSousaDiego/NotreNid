import { Injectable } from '@nestjs/common';

import { BookBarcodeResolverService } from './book-barcode-resolver.service';
import type { ResolveBarcodeDto } from './dto/resolve-barcode.dto';
import type { BarcodeResolveResponse } from './types/barcode-result.types';

/**
 * Point d'entrée unique, indépendant de la catégorie — dispatch vers le
 * resolver spécialisé. `cd`/`dvd` renvoient un statut explicite `unsupported`
 * plutôt qu'un faux résultat : ajouter leur resolver plus tard (MusicBrainz,
 * un provider UPC) ne demandera qu'un nouveau `case`, jamais de changement
 * d'architecture ici ni côté contrôleur/mobile (même forme de réponse).
 */
@Injectable()
export class BarcodeResolverService {
  constructor(private readonly bookResolver: BookBarcodeResolverService) {}

  async resolve(dto: ResolveBarcodeDto): Promise<BarcodeResolveResponse> {
    if (dto.category === 'book') {
      return this.bookResolver.resolve(dto.barcode);
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
