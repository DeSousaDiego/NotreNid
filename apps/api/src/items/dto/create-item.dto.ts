import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ItemCondition } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { BookMetadataDto } from './book-metadata.dto';
import { CdMetadataDto } from './cd-metadata.dto';
import { DvdMetadataDto } from './dvd-metadata.dto';
import { ITEM_RATING_VALUES, type ItemRatingValue } from '../item-rating.constants';

export class CreateItemDto {
  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 'Dune' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: ItemCondition })
  @IsEnum(ItemCondition)
  condition!: ItemCondition;

  @ApiPropertyOptional({
    enum: ITEM_RATING_VALUES,
    description: 'Note sur 5, par pas de 0,5. Absente = pas de note.',
  })
  @IsOptional()
  @IsIn(ITEM_RATING_VALUES)
  rating?: ItemRatingValue;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiProperty({ type: [String], description: 'IDs des membres propriétaires (au moins un)' })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  ownerIds!: string[];

  @ApiPropertyOptional({ type: BookMetadataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BookMetadataDto)
  book?: BookMetadataDto;

  @ApiPropertyOptional({ type: CdMetadataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CdMetadataDto)
  cd?: CdMetadataDto;

  @ApiPropertyOptional({ type: DvdMetadataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DvdMetadataDto)
  dvd?: DvdMetadataDto;

  @ApiPropertyOptional({
    type: Object,
    description: 'Métadonnées pour une catégorie personnalisée',
  })
  @IsOptional()
  @IsObject()
  customMetadata?: Record<string, unknown>;
}
