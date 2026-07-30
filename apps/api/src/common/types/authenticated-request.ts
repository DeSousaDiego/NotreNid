import type { HouseholdRole } from '@prisma/client';
import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  householdMembership?: { role: HouseholdRole };
  requestId?: string;
}

export interface JwtAccessPayload {
  sub: string;
  email: string;
}
