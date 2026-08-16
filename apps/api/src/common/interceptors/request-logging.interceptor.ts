import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

interface RequestWithId extends Request {
  requestId?: string;
}

/**
 * Journalise chaque requête HTTP (méthode, chemin, statut, durée, requestId)
 * en un seul point — le log d'accès minimal attendu par la section 19 du PRD,
 * corrélé au `requestId` déjà posé par RequestIdMiddleware.
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<RequestWithId>();
    const response = httpContext.getResponse<Response>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.logRequest(request, response.statusCode, start),
        error: (error: unknown) => this.logRequest(request, this.resolveErrorStatus(error), start),
      }),
    );
  }

  private logRequest(request: RequestWithId, statusCode: number, start: number): void {
    const durationMs = Date.now() - start;
    this.logger.log(
      `${request.method} ${request.originalUrl} ${statusCode} ${durationMs}ms requestId=${request.requestId ?? '-'}`,
    );
  }

  private resolveErrorStatus(error: unknown): number {
    if (
      error &&
      typeof error === 'object' &&
      'getStatus' in error &&
      typeof (error as { getStatus: unknown }).getStatus === 'function'
    ) {
      return (error as { getStatus: () => number }).getStatus();
    }
    return 500;
  }
}
