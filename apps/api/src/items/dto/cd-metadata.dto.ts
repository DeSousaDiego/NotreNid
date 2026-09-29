import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * Tous les champs sont nullables : `null` explicite (distinct d'une propriété absente)
 * efface la valeur existante lors d'une modification — voir `ItemsService.update`.
 * `type` explicite dans chaque décorateur : l'union `T | null` s'efface en `Object` via
 * les métadonnées `design:type`, ce qui produirait un schéma OpenAPI `object` erroné.
 */
export class CdMetadataDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  artist?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  releaseYear?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  format?: string | null;
}
