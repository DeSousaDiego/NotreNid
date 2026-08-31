import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';

export class CreateInvitationDto {
  @ApiPropertyOptional({
    example: 'sam@example.com',
    description:
      "Facultatif (Bloc 2) : le code d'invitation suffit à rejoindre le foyer. " +
      'Si renseigné, une notification email best-effort est tentée en complément, sans ' +
      "jamais bloquer la création de l'invitation si l'envoi échoue.",
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}
