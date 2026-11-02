import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { MAX_UPLOAD_SIZE_BYTES, UploadsService } from './uploads.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AppException } from '../common/exceptions/app-exception';
import { HouseholdMembershipGuard } from '../common/guards/household-membership.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiStandardErrors } from '../common/swagger/api-standard-errors.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-request';

@ApiTags('uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
@Controller('households/:householdId/uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_SIZE_BYTES } }))
  @ApiOperation({
    summary:
      'Téléverse une image de couverture (JPEG/PNG/WebP, validé par signature binaire, 10 Mo max).',
  })
  @ApiResponse({
    status: 201,
    description:
      "Identifiant de l'upload (à utiliser pour le supprimer) et URL publique de l'image.",
  })
  @ApiStandardErrors(400, 401, 403, 404)
  upload(
    @Param('householdId') householdId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Aucun fichier reçu.');
    }
    return this.uploadsService.createHouseholdUpload(householdId, user.id, file);
  }

  @Delete(':uploadId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      "Supprime une image téléversée dans ce foyer. Un upload d'un autre foyer, inconnu ou antérieur à Release 0A répond 404.",
  })
  @ApiResponse({ status: 204, description: 'Fichier supprimé.' })
  @ApiStandardErrors(401, 403, 404)
  async remove(
    @Param('householdId') householdId: string,
    @Param('uploadId') uploadId: string,
  ): Promise<void> {
    await this.uploadsService.deleteHouseholdUpload(householdId, uploadId);
  }
}
