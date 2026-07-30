import { randomUUID } from 'node:crypto';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { detectImageType } from './image-signature';
import { AppException } from '../common/exceptions/app-exception';

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo

@Injectable()
export class UploadsService {
  private readonly uploadDir = path.resolve(process.cwd(), 'storage', 'uploads');

  constructor(private readonly configService: ConfigService) {}

  async save(file: { buffer: Buffer; size: number }): Promise<{ id: string; url: string }> {
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'FILE_TOO_LARGE',
        `Le fichier dépasse la taille maximale autorisée (${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)} Mo).`,
      );
    }

    const detectedType = detectImageType(file.buffer);
    if (!detectedType) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'INVALID_FILE_TYPE',
        'Formats acceptés : JPEG, PNG, WebP. Le contenu du fichier ne correspond à aucun de ces formats.',
      );
    }

    await mkdir(this.uploadDir, { recursive: true });
    const filename = `${randomUUID()}.${detectedType === 'jpeg' ? 'jpg' : detectedType}`;
    await writeFile(path.join(this.uploadDir, filename), file.buffer);

    const apiPublicUrl = this.configService.get<string>('API_PUBLIC_URL') ?? '';
    return { id: filename, url: `${apiPublicUrl}/uploads/${filename}` };
  }

  async remove(filename: string): Promise<void> {
    const filePath = this.resolveSafePath(filename);
    try {
      await stat(filePath);
    } catch {
      throw new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', "Ce fichier n'existe pas.");
    }
    await rm(filePath);
  }

  /** Empêche toute traversée de répertoire (`../..`) via le paramètre reçu du client. */
  private resolveSafePath(filename: string): string {
    const resolved = path.resolve(this.uploadDir, filename);
    if (!resolved.startsWith(this.uploadDir + path.sep)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Nom de fichier invalide.',
      );
    }
    return resolved;
  }
}
