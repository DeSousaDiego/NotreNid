import { Module } from '@nestjs/common';

import { BarcodeCacheService } from './barcode-cache.service';
import { BarcodeResolverService } from './barcode-resolver.service';
import { BarcodeController } from './barcode.controller';
import { BookBarcodeResolverService } from './book-barcode-resolver.service';
import { CdBarcodeResolverService } from './cd-barcode-resolver.service';
import { CoverArtArchiveProvider } from './providers/cover-art-archive.provider';
import { GoogleBooksProvider } from './providers/google-books.provider';
import { MusicBrainzArtistCacheService } from './providers/musicbrainz-artist-cache.service';
import { MusicBrainzRateLimiterService } from './providers/musicbrainz-rate-limiter.service';
import { MusicBrainzProvider } from './providers/musicbrainz.provider';
import { OpenLibraryProvider } from './providers/open-library.provider';

@Module({
  controllers: [BarcodeController],
  providers: [
    BarcodeResolverService,
    BookBarcodeResolverService,
    CdBarcodeResolverService,
    GoogleBooksProvider,
    OpenLibraryProvider,
    MusicBrainzProvider,
    MusicBrainzRateLimiterService,
    MusicBrainzArtistCacheService,
    CoverArtArchiveProvider,
    BarcodeCacheService,
  ],
})
export class BarcodeModule {}
