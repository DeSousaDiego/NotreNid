import { Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { InvitationsService } from './invitations.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiStandardErrors } from '../common/swagger/api-standard-errors.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-request';

@ApiTags('invitations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('invitations')
export class InvitationsPublicController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post(':token/accept')
  @ApiOperation({
    summary:
      "Accepte une invitation par son jeton (l'email du compte connecté doit correspondre à l'invitation).",
  })
  @ApiResponse({
    status: 201,
    description: 'Invitation acceptée, utilisateur ajouté au household.',
  })
  @ApiStandardErrors(400, 401, 404, 409)
  accept(@Param('token') token: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invitationsService.accept(token, user.id, user.email);
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
