import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { BarcodeResolverService } from './barcode-resolver.service';
import { ResolveBarcodeDto } from './dto/resolve-barcode.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiStandardErrors } from '../../common/swagger/api-standard-errors.decorator';

// Recherche externe coûteuse (Google Books/Open Library, futur MusicBrainz) —
// limite plus stricte que la limite globale par défaut (100/60s, AppModule),
// sans être aussi sévère que l'authentification (AuthController).
const BARCODE_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

/**
 * Pas de `householdId` dans la route (contrairement à `ItemsController`) :
 * cette route ne lit ni n'écrit aucune donnée de household, uniquement une
 * recherche externe en lecture seule — `HouseholdMembershipGuard` n'aurait
 * rien à vérifier ici. Seule l'authentification est requise.
 */
@ApiTags('items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('items/barcode')
export class BarcodeController {
  constructor(private readonly barcodeResolverService: BarcodeResolverService) {}

  @Post('resolve')
  @HttpCode(HttpStatus.OK)
  @Throttle(BARCODE_THROTTLE)
  @ApiOperation({
    summary:
      'Résout un code-barres via un fournisseur externe (livre : Google Books puis Open ' +
      'Library). CD/DVD renvoient un statut "unsupported" explicite. Ne crée ni ne modifie ' +
      'jamais un item.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Résultat de la recherche (structure stable indépendamment du fournisseur) — voir ' +
      '`status` pour distinguer un match, une absence de résultat, une catégorie non gérée ' +
      "ou un échec technique des fournisseurs externes. Toujours 200, jamais d'erreur pour " +
      'une simple absence de résultat.',
  })
  @ApiStandardErrors(400, 401, 429)
  resolve(@Body() dto: ResolveBarcodeDto) {
    return this.barcodeResolverService.resolve(dto);
  }
}
