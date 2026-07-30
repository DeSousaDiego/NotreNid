import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { HouseholdMembershipGuard } from './guards/household-membership.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * Fournit globalement le JwtService et les guards partagés (authentification,
 * appartenance à un household) afin que chaque module métier puisse utiliser
 * `@UseGuards(JwtAuthGuard, HouseholdMembershipGuard)` sans réimporter JwtModule.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [JwtAuthGuard, HouseholdMembershipGuard],
  exports: [JwtModule, JwtAuthGuard, HouseholdMembershipGuard],
})
export class CommonModule {}
