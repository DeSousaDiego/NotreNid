import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { StorageDriver } from './storage-driver.interface';
import { AppException } from '../../common/exceptions/app-exception';

/**
 * Stockage objet compatible S3 (AWS S3, Supabase Storage, MinIO) — production
 * (docs/NOTRE_NID_PRD.md sections 10 et 21). Le bucket doit être configuré en lecture
 * publique pour les couvertures d'items ; voir docs/DEPLOYMENT.md.
 */
@Injectable()
export class S3StorageDriver implements StorageDriver {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrlBase: string;

  constructor(configService: ConfigService) {
    const endpoint = configService.get<string>('STORAGE_ENDPOINT') || undefined;
    const region = configService.get<string>('STORAGE_REGION') || 'us-east-1';
    this.bucket = configService.get<string>('STORAGE_BUCKET') ?? '';
    this.client = new S3Client({
      region,
      endpoint,
      // Un endpoint personnalisé (MinIO, Supabase Storage) exige le style à chemin
      // (bucket dans le chemin) ; AWS S3 réel utilise le style virtual-hosted par défaut.
      forcePathStyle: Boolean(endpoint),
      credentials: {
        accessKeyId: configService.get<string>('STORAGE_ACCESS_KEY') ?? '',
        secretAccessKey: configService.get<string>('STORAGE_SECRET_KEY') ?? '',
      },
    });
    this.publicUrlBase = endpoint
      ? `${endpoint.replace(/\/$/, '')}/${this.bucket}`
      : `https://${this.bucket}.s3.${region}.amazonaws.com`;
  }

  async save(file: {
    buffer: Buffer;
    filename: string;
    contentType: string;
  }): Promise<{ id: string; url: string }> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: file.filename,
        Body: file.buffer,
        ContentType: file.contentType,
      }),
    );
    return { id: file.filename, url: `${this.publicUrlBase}/${file.filename}` };
  }

  async remove(filename: string): Promise<void> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: filename }));
    } catch {
      throw new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', "Ce fichier n'existe pas.");
    }
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: filename }));
  }
}
