import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const CATEGORY_FIELD_TYPES = ['string', 'number', 'boolean'] as const;
export type CategoryFieldType = (typeof CATEGORY_FIELD_TYPES)[number];

/** Décrit un champ personnalisé d'une catégorie (Category.metadataSchema). */
export class CategoryFieldSchemaDto {
  @ApiProperty({ example: 'edition' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  key!: string;

  @ApiProperty({ example: 'Édition' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @ApiProperty({ enum: CATEGORY_FIELD_TYPES })
  @IsIn(CATEGORY_FIELD_TYPES)
  type!: CategoryFieldType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}
