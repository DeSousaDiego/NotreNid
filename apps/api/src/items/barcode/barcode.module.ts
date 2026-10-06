import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BarcodeCacheService } from './barcode-cache.service';
import { BarcodeResolverService } from './barcode-resolver.service';
import { BarcodeController } from './barcode.controller';
import { BookBarcodeResolverService } from './book-barcode-resolver.service';
import { CdBarcodeResolverService } from './cd-barcode-resolver.service';
import { DvdBarcodeResolverService } from './dvd-barcode-resolver.service';
import { DvdEnrichmentService } from './dvd-enrichment.service';
import { ProductImageValidator } from './product-image-validator.service';
import { CoverArtArchiveProvider } from './providers/cover-art-archive.provider';
import { DigitEyesProvider } from './providers/digit-eyes.provider';
import { selectDvdProductProvider } from './providers/dvd-product-provider.factory';
import { DVD_PRODUCT_PROVIDER } from './providers/dvd-product-provider.interface';
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
    DigitEyesProvider,
    {
      // Un seul provider produit actif, choisi au démarrage — voir
      // `selectDvdProductProvider` (valeur inconnue = démarrage refusé).
      provide: DVD_PRODUCT_PROVIDER,
      inject: [ConfigService, UpcItemDbProvider, DigitEyesProvider],
      useFactory: selectDvdProductProvider,
    },
    ProductImageValidator,
    TmdbProvider,
    TmdbRateLimiterService,
    BarcodeCacheService,
  ],
})
export class BarcodeModule {}
