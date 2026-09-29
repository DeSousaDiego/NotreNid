import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * Tous les champs sont nullables : `null` explicite (distinct d'une propriété absente)
 * efface la valeur existante lors d'une modification — voir `ItemsService.update`.
 * `type` explicite dans chaque décorateur : l'union `T | null` s'efface en `Object` via
 * les métadonnées `design:type`, ce qui produirait un schéma OpenAPI `object` erroné.
 */
export class BookMetadataDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  author?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  isbn?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  publisher?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  publicationYear?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  language?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  pageCount?: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Hardcover',
    description:
      'Format physique de l’édition (ex. "Hardcover", "Paperback", "Mass Market ' +
      'Paperback"). Texte libre, non normalisé — même convention que ' +
      'CdMetadataDto.format/DvdMetadataDto.format.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  format?: string | null;
}
