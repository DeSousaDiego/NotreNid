import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class BookMetadataDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  author?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  isbn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  publisher?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  publicationYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  pageCount?: number;

  @ApiPropertyOptional({
    example: 'Hardcover',
    description:
      'Format physique de l’édition (ex. "Hardcover", "Paperback", "Mass Market ' +
      'Paperback"). Texte libre, non normalisé — même convention que ' +
      'CdMetadataDto.format/DvdMetadataDto.format.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  format?: string;
}
