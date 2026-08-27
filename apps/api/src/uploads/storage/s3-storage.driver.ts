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
 * Stockage objet compatible S3 (AWS S3, Supabase Storage, MinIO, Cloudflare R2) —
 * production (docs/NOTRE_NID_PRD.md sections 10 et 21). Le bucket doit être configuré en
 * lecture publique pour les couvertures d'items ; voir docs/DEPLOYMENT.md.
 *
 * STORAGE_ENDPOINT et STORAGE_PUBLIC_URL sont deux notions distinctes qu'il ne faut jamais
 * confondre : STORAGE_ENDPOINT est l'endpoint S3 authentifié utilisé uniquement par
 * S3Client pour les opérations d'upload/suppression (ex. Cloudflare R2 :
 * https://<account>.r2.cloudflarestorage.com, jamais accessible publiquement) ;
 * STORAGE_PUBLIC_URL est la base d'URL réellement utilisée par le mobile pour afficher une
 * couverture (ex. un domaine personnalisé ou une URL *.r2.dev pour R2). Sur AWS S3 et la
 * plupart des configurations MinIO/Supabase Storage, ces deux notions coïncident
 * historiquement (l'endpoint sert aussi de base publique) — STORAGE_PUBLIC_URL reste donc
 * optionnelle et, absente, le comportement précédent (construit à partir de
 * STORAGE_ENDPOINT/STORAGE_BUCKET) est préservé à l'identique pour ne pas casser ces
 * configurations existantes.
 */
@Injectable()
export class S3StorageDriver implements StorageDriver {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrlBase: string;

  constructor(configService: ConfigService) {
    // Requis pour que le driver fonctionne : une valeur manquante doit faire échouer le
    // démarrage avec un message explicite plutôt que produire des requêtes S3 silencieusement
    // cassées (bucket vide, identifiants vides) — cohérent avec configService.getOrThrow déjà
    // utilisé ailleurs dans l'API pour la configuration requise (voir auth.service.ts,
    // prisma.service.ts).
    this.bucket = configService.getOrThrow<string>('STORAGE_BUCKET');
    const accessKeyId = configService.getOrThrow<string>('STORAGE_ACCESS_KEY');
    const secretAccessKey = configService.getOrThrow<string>('STORAGE_SECRET_KEY');

    // Endpoint S3 authentifié uniquement — jamais utilisé pour construire une URL publique.
    // Optionnel : absent, le SDK AWS résout l'endpoint global réel de S3.
    const endpoint = configService.get<string>('STORAGE_ENDPOINT') || undefined;
    const region = configService.get<string>('STORAGE_REGION') || 'us-east-1';
    this.client = new S3Client({
      region,
      endpoint,
      // Un endpoint personnalisé (MinIO, Supabase Storage, R2) exige le style à chemin
      // (bucket dans le chemin) ; AWS S3 réel utilise le style virtual-hosted par défaut.
      forcePathStyle: Boolean(endpoint),
      credentials: { accessKeyId, secretAccessKey },
    });

    this.publicUrlBase = S3StorageDriver.resolvePublicUrlBase(
      configService.get<string>('STORAGE_PUBLIC_URL'),
      endpoint,
      this.bucket,
      region,
    );
  }

  private static resolvePublicUrlBase(
    publicUrl: string | undefined,
    endpoint: string | undefined,
    bucket: string,
    region: string,
  ): string {
    // 1. STORAGE_PUBLIC_URL explicite : base d'URL déjà propre à un bucket (domaine
    //    personnalisé, URL *.r2.dev, CDN...) — jamais suffixée par le nom du bucket.
    if (publicUrl) {
      return publicUrl.replace(/\/$/, '');
    }
    // 2. Pas de STORAGE_PUBLIC_URL, mais un endpoint personnalisé (MinIO/Supabase Storage) :
    //    comportement historique préservé — l'endpoint sert aussi de base publique, avec le
    //    bucket dans le chemin (style à chemin).
    if (endpoint) {
      return `${endpoint.replace(/\/$/, '')}/${bucket}`;
    }
    // 3. AWS S3 réel, aucun des deux configuré : URL virtual-hosted standard.
    return `https://${bucket}.s3.${region}.amazonaws.com`;
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
