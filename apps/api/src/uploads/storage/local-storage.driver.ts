import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { StorageDriver } from './storage-driver.interface';
import { AppException } from '../../common/exceptions/app-exception';

/**
 * Stockage sur disque local — développement uniquement (docs/NOTRE_NID_PRD.md section 10).
 *
 * Les URLs renvoyées sont `<API_PUBLIC_URL>/uploads/<fichier>`. Sans API_PUBLIC_URL, elles
 * sont relatives (`/uploads/…`) : inutilisables par un téléphone, qui n'exécute pas l'API.
 * En dev sur appareil, renseigner l'adresse réellement jointe par le téléphone (ex.
 * `http://<IP-LAN-du-PC>:3000`, voir .env.example) — jamais codée en dur ici.
 */
@Injectable()
export class LocalStorageDriver implements StorageDriver {
  private readonly uploadDir = path.resolve(process.cwd(), 'storage', 'uploads');
  private readonly publicBaseUrl: string;

  constructor(configService: ConfigService) {
    this.publicBaseUrl = (configService.get<string>('API_PUBLIC_URL') ?? '')
      .trim()
      .replace(/\/+$/, '');
    if (!this.publicBaseUrl) {
      new Logger(LocalStorageDriver.name).warn(
        'API_PUBLIC_URL non définie : les images locales auront des URLs relatives (/uploads/…), ' +
          "que l'app mobile ne peut pas afficher. Renseignez l'adresse de l'API vue par le téléphone.",
      );
    }
  }

  async save(file: {
    buffer: Buffer;
    filename: string;
    contentType: string;
  }): Promise<{ id: string; url: string }> {
    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(path.join(this.uploadDir, file.filename), file.buffer);
    return { id: file.filename, url: `${this.publicBaseUrl}/uploads/${file.filename}` };
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
