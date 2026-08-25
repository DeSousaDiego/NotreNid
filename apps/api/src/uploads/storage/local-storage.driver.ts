import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { StorageDriver } from './storage-driver.interface';
import { AppException } from '../../common/exceptions/app-exception';

/** Stockage sur disque local — développement uniquement (docs/NOTRE_NID_PRD.md section 10). */
@Injectable()
export class LocalStorageDriver implements StorageDriver {
  private readonly uploadDir = path.resolve(process.cwd(), 'storage', 'uploads');

  constructor(private readonly configService: ConfigService) {}

  async save(file: {
    buffer: Buffer;
    filename: string;
    contentType: string;
  }): Promise<{ id: string; url: string }> {
    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(path.join(this.uploadDir, file.filename), file.buffer);
    const apiPublicUrl = this.configService.get<string>('API_PUBLIC_URL') ?? '';
    return { id: file.filename, url: `${apiPublicUrl}/uploads/${file.filename}` };
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

  /**
   * Défense en profondeur contre une traversée de répertoire (`../..`) : `filename` est déjà
   * validé en amont par UploadsService contre un format fixe (UUID + extension connue).
   */
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
