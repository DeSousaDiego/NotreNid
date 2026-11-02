import { randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { UploadKind } from '@prisma/client';

import { detectImageType } from './image-signature';
import { STORAGE_DRIVER, type StorageDriver } from './storage/storage-driver.interface';
import { AppException } from '../common/exceptions/app-exception';
import { PrismaService } from '../prisma/prisma.service';

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo

// Format exact des noms de fichiers générés par `save()` (UUID v4 + extension connue) :
// revalidé ici avant toute suppression, indépendamment du driver de stockage utilisé,
// pour ne jamais transmettre une clé/chemin non maîtrisé(e) au driver actif.
const SAFE_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

export interface UploadResult {
  id: string;
  url: string;
}

interface StoredFile {
  storageKey: string;
  url: string;
  contentType: string;
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    @Inject(STORAGE_DRIVER) private readonly storageDriver: StorageDriver,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Téléverse une couverture dans un foyer. L'appartenance de l'appelant au foyer est
   * vérifiée en amont (HouseholdMembershipGuard) ; `householdId` vient de la route, jamais
   * du corps de la requête.
   *
   * Ordre : stockage, puis ligne `Upload`. Si l'écriture en base échoue, le fichier tout
   * juste stocké est supprimé (compensation best-effort, journalisée en cas d'échec) : un
   * fichier sans ligne serait impossible à supprimer ensuite via l'API.
   */
  async createHouseholdUpload(
    householdId: string,
    uploadedById: string,
    file: { buffer: Buffer; size: number },
  ): Promise<UploadResult> {
    const stored = await this.store(file);
    try {
      const upload = await this.prisma.upload.create({
        data: {
          storageKey: stored.storageKey,
          householdId,
          uploadedById,
          kind: UploadKind.ITEM_COVER,
          contentType: stored.contentType,
          sizeBytes: file.size,
        },
      });
      return { id: upload.id, url: stored.url };
    } catch (error) {
      await this.storageDriver.remove(stored.storageKey).catch(() => {
        this.logger.warn(`Fichier orphelin après échec d'enregistrement : ${stored.storageKey}`);
      });
      throw error;
    }
  }

  /**
   * Supprime un upload du foyer. Seule la ligne `Upload` (id ET foyer) autorise la
   * suppression : un identifiant d'un autre foyer, inconnu, ou un ancien nom de fichier
   * produit la même 404, sans révéler si le fichier existe ailleurs.
   *
   * Ordre : stockage, puis ligne. Si le stockage échoue, la ligne reste et l'opération peut
   * être relancée ; un fichier déjà absent du stockage (relance après un échec en base) est
   * traité comme supprimé, pour que la ligne puisse toujours disparaître.
   */
  async deleteHouseholdUpload(householdId: string, uploadId: string): Promise<void> {
    const upload = await this.prisma.upload.findFirst({ where: { id: uploadId, householdId } });
    if (!upload) {
      throw new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', "Cette image n'existe pas.");
    }

    try {
      await this.remove(upload.storageKey);
    } catch (error) {
      if (!(error instanceof AppException && error.getStatus() === HttpStatus.NOT_FOUND)) {
        throw error;
      }
    }
    await this.prisma.upload.deleteMany({ where: { id: upload.id, householdId } });
  }

  /**
   * Stockage brut, sans ligne `Upload` — réservé aux fichiers rattachés à un utilisateur
   * (avatar, voir UsersService). Ne doit jamais être exposé par une route de foyer.
   */
  async save(file: { buffer: Buffer; size: number }): Promise<UploadResult> {
    const stored = await this.store(file);
    return { id: stored.storageKey, url: stored.url };
  }

  /**
   * Suppression brute d'un objet de stockage, sans contrôle d'appartenance — réservée aux
   * appelants qui détiennent déjà la clé de façon fiable (avatar de l'utilisateur courant,
   * ligne `Upload` vérifiée). Ne doit jamais recevoir une clé fournie par un client.
   */
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

  private async store(file: { buffer: Buffer; size: number }): Promise<StoredFile> {
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
    const contentType = `image/${detectedType}`;
    const saved = await this.storageDriver.save({
      buffer: file.buffer,
      filename: `${randomUUID()}.${extension}`,
      contentType,
    });
    return { storageKey: saved.id, url: saved.url, contentType };
  }
}
