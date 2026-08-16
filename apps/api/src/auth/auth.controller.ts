import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiStandardErrors } from '../common/swagger/api-standard-errors.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-request';

// Limites renforcées sur les routes d'authentification non protégées par JWT
// (cible privilégiée du bourrage d'identifiants / force brute), au-delà de la
// limite globale par défaut définie dans AppModule.
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Crée un compte et retourne un access token et un refresh token.' })
  @ApiResponse({ status: 201, description: 'Compte créé, session ouverte.' })
  @ApiStandardErrors(400, 409, 429)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Authentifie un utilisateur et retourne une nouvelle session.' })
  @ApiResponse({ status: 200, description: 'Identifiants valides, session ouverte.' })
  @ApiStandardErrors(400, 401, 429)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({
    summary: 'Fait tourner le refresh token et retourne un nouveau couple de tokens.',
  })
  @ApiResponse({ status: 200, description: 'Nouveau couple access/refresh token.' })
  @ApiStandardErrors(400, 401, 429)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Révoque le refresh token fourni (déconnexion de cet appareil).' })
  @ApiResponse({ status: 204, description: 'Session révoquée.' })
  @ApiStandardErrors(400)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Révoque toutes les sessions actives de l'utilisateur courant." })
  @ApiResponse({ status: 204, description: 'Toutes les sessions ont été révoquées.' })
  @ApiStandardErrors(401)
  async logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.authService.logoutAll(user.id);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Retourne le profil de l'utilisateur authentifié." })
  @ApiResponse({ status: 200, description: "Profil de l'utilisateur courant." })
  @ApiStandardErrors(401)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }
}
