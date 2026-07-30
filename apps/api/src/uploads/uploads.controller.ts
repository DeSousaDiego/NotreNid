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
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';

import { MAX_UPLOAD_SIZE_BYTES, UploadsService } from './uploads.service';
import { AppException } from '../common/exceptions/app-exception';
import { HouseholdMembershipGuard } from '../common/guards/household-membership.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HouseholdMembershipGuard)
@Controller('households/:householdId/uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_SIZE_BYTES } }))
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'Aucun fichier reçu.');
    }
    return this.uploadsService.save(file);
  }

  @Delete(':uploadId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('uploadId') uploadId: string): Promise<void> {
    await this.uploadsService.remove(uploadId);
  }
}
