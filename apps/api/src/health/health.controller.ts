import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

interface HealthStatus {
  status: 'ok';
  timestamp: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  // La vérification de disponibilité de la base de données sera ajoutée en Phase 2,
  // une fois le PrismaModule branché à l'application.
  @Get('ready')
  ready(): HealthStatus {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
