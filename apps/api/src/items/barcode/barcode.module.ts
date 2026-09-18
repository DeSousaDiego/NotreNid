import { Module } from '@nestjs/common';

import { BarcodeCacheService } from './barcode-cache.service';
import { BarcodeResolverService } from './barcode-resolver.service';
import { BarcodeController } from './barcode.controller';
import { BookBarcodeResolverService } from './book-barcode-resolver.service';
import { GoogleBooksProvider } from './providers/google-books.provider';
import { OpenLibraryProvider } from './providers/open-library.provider';

@Module({
  controllers: [BarcodeController],
  providers: [
    BarcodeResolverService,
    BookBarcodeResolverService,
    GoogleBooksProvider,
    OpenLibraryProvider,
    BarcodeCacheService,
  ],
})
export class BarcodeModule {}
