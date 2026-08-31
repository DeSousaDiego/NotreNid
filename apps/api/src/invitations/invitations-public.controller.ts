import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { InvitationsService } from './invitations.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiStandardErrors } from '../common/swagger/api-standard-errors.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-request';

// Le code n'a qu'environ 39,6 bits d'entropie (8 caractères, alphabet de 31 symboles) :
// contrairement à l'ancien jeton de 256 bits, cet endpoint doit être limité en débit pour
// ne jamais devenir un oracle de test de codes par force brute en ligne (docs/NOTRE_NID_PRD.md,
// Bloc 2, section 12). Même limite que les routes d'authentification (AuthController).
const INVITATION_ACCEPT_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('invitations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('invitations')
export class InvitationsPublicController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post('accept')
  @Throttle(INVITATION_ACCEPT_THROTTLE)
  @ApiOperation({
    summary:
      "Rejoint un household grâce à un code d'invitation. Le code est normalisé côté " +
      "serveur (casse, séparateurs, préfixe d'affichage) avant vérification.",
  })
  @ApiResponse({
    status: 201,
    description: 'Invitation acceptée, utilisateur ajouté au household.',
  })
  @ApiStandardErrors(400, 401, 404, 409)
  accept(@Body() dto: AcceptInvitationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invitationsService.accept(dto.code, user.id);
  }

  @Post(':invitationId/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Révoque une invitation en attente (réservé à OWNER/ADMIN du household concerné).',
  })
  @ApiResponse({ status: 204, description: 'Invitation révoquée.' })
  @ApiStandardErrors(401, 403, 404)
  async revoke(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.invitationsService.revoke(invitationId, user.id);
  }
}
