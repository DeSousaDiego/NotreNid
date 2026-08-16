import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';

import { AppException } from '../common/exceptions/app-exception';
import { PrismaService } from '../prisma/prisma.service';

interface HealthStatus {
  status: 'ok';
  timestamp: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Vérifie que le processus de l'API répond (liveness)." })
  check(): HealthStatus {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({
    summary:
      'Vérifie que les dépendances critiques (base de données) sont disponibles (readiness).',
  })
  @ApiServiceUnavailableResponse({ description: 'La base de données est injoignable.' })
  async ready(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'DATABASE_UNAVAILABLE',
        'La base de données est injoignable.',
      );
    }
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
