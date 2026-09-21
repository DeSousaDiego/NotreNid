import { Module } from '@nestjs/common';

import { BarcodeCacheService } from './barcode-cache.service';
import { BarcodeResolverService } from './barcode-resolver.service';
import { BarcodeController } from './barcode.controller';
import { BookBarcodeResolverService } from './book-barcode-resolver.service';
import { CdBarcodeResolverService } from './cd-barcode-resolver.service';
import { DvdBarcodeResolverService } from './dvd-barcode-resolver.service';
import { DvdEnrichmentService } from './dvd-enrichment.service';
import { CoverArtArchiveProvider } from './providers/cover-art-archive.provider';
import { GoogleBooksProvider } from './providers/google-books.provider';
import { MusicBrainzArtistCacheService } from './providers/musicbrainz-artist-cache.service';
import { MusicBrainzRateLimiterService } from './providers/musicbrainz-rate-limiter.service';
import { MusicBrainzProvider } from './providers/musicbrainz.provider';
import { OpenLibraryProvider } from './providers/open-library.provider';
import { TmdbRateLimiterService } from './providers/tmdb-rate-limiter.service';
import { TmdbProvider } from './providers/tmdb.provider';
import { UpcItemDbRateLimiterService } from './providers/upcitemdb-rate-limiter.service';
import { UpcItemDbProvider } from './providers/upcitemdb.provider';

@Module({
  controllers: [BarcodeController],
  providers: [
    BarcodeResolverService,
    BookBarcodeResolverService,
    CdBarcodeResolverService,
    DvdBarcodeResolverService,
    DvdEnrichmentService,
    GoogleBooksProvider,
    OpenLibraryProvider,
    MusicBrainzProvider,
    MusicBrainzRateLimiterService,
    MusicBrainzArtistCacheService,
    CoverArtArchiveProvider,
    UpcItemDbProvider,
    UpcItemDbRateLimiterService,
    TmdbProvider,
    TmdbRateLimiterService,
    BarcodeCacheService,
  ],
})
export class BarcodeModule {}
