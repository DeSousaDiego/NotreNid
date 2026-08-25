import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LocalStorageDriver } from './storage/local-storage.driver';
import { S3StorageDriver } from './storage/s3-storage.driver';
import { STORAGE_DRIVER } from './storage/storage-driver.interface';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [
    UploadsService,
    {
      provide: STORAGE_DRIVER,
      // STORAGE_DRIVER=local (développement, disque local) | s3 (production, S3-compatible /
      // Supabase Storage) — voir docs/NOTRE_NID_PRD.md section 10 et docs/DEPLOYMENT.md.
      useFactory: (configService: ConfigService) =>
        configService.get<string>('STORAGE_DRIVER') === 's3'
          ? new S3StorageDriver(configService)
          : new LocalStorageDriver(configService),
      inject: [ConfigService],
    },
  ],
})
export class UploadsModule {}
