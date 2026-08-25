import { randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { detectImageType } from './image-signature';
import { STORAGE_DRIVER, type StorageDriver } from './storage/storage-driver.interface';
import { AppException } from '../common/exceptions/app-exception';

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo

// Format exact des noms de fichiers générés par `save()` (UUID v4 + extension connue) :
// revalidé ici avant toute suppression, indépendamment du driver de stockage utilisé,
// pour ne jamais transmettre une clé/chemin non maîtrisé(e) au driver actif.
const SAFE_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

@Injectable()
export class UploadsService {
  constructor(@Inject(STORAGE_DRIVER) private readonly storageDriver: StorageDriver) {}

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

    const extension = detectedType === 'jpeg' ? 'jpg' : detectedType;
    const filename = `${randomUUID()}.${extension}`;
    return this.storageDriver.save({
      buffer: file.buffer,
      filename,
      contentType: `image/${detectedType}`,
    });
  }

  async remove(filename: string): Promise<void> {
    if (!SAFE_FILENAME_PATTERN.test(filename)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Nom de fichier invalide.',
      );
    }
    await this.storageDriver.remove(filename);
  }
}
