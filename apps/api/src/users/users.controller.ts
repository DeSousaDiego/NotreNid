import {
  Body,
  Controller,
  Delete,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AppException } from '../common/exceptions/app-exception';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiStandardErrors } from '../common/swagger/api-standard-errors.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-request';
import { MAX_UPLOAD_SIZE_BYTES } from '../uploads/uploads.service';

// Pas de HouseholdMembershipGuard ici : une photo/un nom de profil sont des ressources
// utilisateur, pas des ressources household (docs/NOTRE_NID_PRD.md — le household est
// un espace de visibilité/collaboration, pas l'identité de l'utilisateur).
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  @ApiOperation({ summary: "Met à jour le profil de l'utilisateur authentifié (nom affiché)." })
  @ApiResponse({ status: 200, description: 'Profil mis à jour.' })
  @ApiStandardErrors(400, 401)
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Post('me/avatar')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_SIZE_BYTES } }))
  @ApiOperation({
    summary: "Remplace la photo de profil de l'utilisateur authentifié (JPEG/PNG/WebP, 10 Mo max).",
  })
  @ApiResponse({ status: 201, description: 'Profil mis à jour avec la nouvelle photo.' })
  @ApiStandardErrors(400, 401)
  updateAvatar(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Aucun fichier reçu.');
    }
    return this.usersService.updateAvatar(user.id, file);
  }

  @Delete('me/avatar')
  @ApiOperation({ summary: "Retire la photo de profil de l'utilisateur authentifié." })
  @ApiResponse({ status: 200, description: 'Profil mis à jour sans photo.' })
  @ApiStandardErrors(401)
  removeAvatar(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.removeAvatar(user.id);
  }
}
