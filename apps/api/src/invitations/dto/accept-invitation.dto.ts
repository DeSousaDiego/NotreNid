import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

import { normalizeInvitationCode } from '../invitation-code.util';

export class AcceptInvitationDto {
  @ApiProperty({
    example: 'NID-7K4P-2Q9D',
    description:
      "Code d'invitation à 8 caractères. Accepté avec ou sans séparateurs/préfixe " +
      "d'affichage (« NID- »), insensible à la casse : normalisé côté serveur avant " +
      'vérification. Un format invalide est rejeté avant toute recherche en base ' +
      '(évite de transformer cet endpoint en oracle de test de codes).',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeInvitationCode(value) : value,
  )
  @IsString()
  @Length(1, 32)
  code!: string;
}
