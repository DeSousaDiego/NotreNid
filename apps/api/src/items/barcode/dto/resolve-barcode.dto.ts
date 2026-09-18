import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

import { BARCODE_CATEGORIES, type BarcodeCategory } from '../types/barcode-category.type';

/**
 * Validation générique de forme (EAN-8, UPC-A, EAN-13 : 8, 12 ou 13 chiffres)
 * — commune aux trois catégories, indépendante de toute logique métier propre à
 * une catégorie (ex. le préfixe 978/979 identifiant un ISBN pour `book`, traité
 * séparément dans `barcode-validation.util.ts`). Volontairement stricte : un
 * code ne correspondant à aucune de ces longueurs n'est pas un futur format non
 * géré, c'est une valeur invalide (ni EAN ni UPC standard).
 */
const BARCODE_SHAPE_PATTERN = /^(\d{8}|\d{12}|\d{13})$/;

export class ResolveBarcodeDto {
  @ApiProperty({
    example: '9782070368228',
    description:
      'Code-barres scanné ou saisi (EAN-8, UPC-A ou EAN-13 — uniquement des chiffres). ' +
      "Trimmed automatiquement ; la longueur maximale (32) suit celle d'`Item.barcode`, " +
      'bien que la forme valide réelle soit toujours strictement 8, 12 ou 13 chiffres.',
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(32)
  @Matches(BARCODE_SHAPE_PATTERN, {
    message: 'barcode doit contenir uniquement des chiffres, sur 8, 12 ou 13 caractères.',
  })
  barcode!: string;

  @ApiProperty({ enum: BARCODE_CATEGORIES, example: 'book' })
  @IsIn(BARCODE_CATEGORIES)
  category!: BarcodeCategory;
}
