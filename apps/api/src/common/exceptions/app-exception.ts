import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Exception applicative portant un code métier stable (ex. `LAST_OWNER_CANNOT_LEAVE`),
 * consommé tel quel par le mobile pour distinguer les cas d'erreur. Voir
 * docs/NOTRE_NID_PRD.md section 18 pour le format de réponse standard.
 */
export class AppException extends HttpException {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: HttpStatus, code: string, message: string, details?: unknown) {
    super(message, status);
    this.code = code;
    this.details = details;
  }
}
