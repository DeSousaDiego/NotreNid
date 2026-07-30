import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AppException } from '../exceptions/app-exception';

const DEFAULT_CODES: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
};

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details: unknown[];
  requestId?: string;
}

/**
 * Filtre global produisant le format d'erreur standard de la section 18 du PRD :
 * { statusCode, code, message, details, requestId }. Ne renvoie jamais de stack trace.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const body = this.buildBody(exception, request.requestId);
    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${body.statusCode}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }
    response.status(body.statusCode).json(body);
  }

  private buildBody(exception: unknown, requestId?: string): ErrorBody {
    if (exception instanceof AppException) {
      return {
        statusCode: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        details: Array.isArray(exception.details) ? exception.details : [],
        requestId,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const { message, details } = this.extractMessageAndDetails(response, exception.message);
      return {
        statusCode: status,
        code: DEFAULT_CODES[status] ?? 'ERROR',
        message,
        details,
        requestId,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: "Une erreur inattendue s'est produite.",
      details: [],
      requestId,
    };
  }

  private extractMessageAndDetails(
    response: string | object,
    fallbackMessage: string,
  ): { message: string; details: unknown[] } {
    if (typeof response === 'string') {
      return { message: response, details: [] };
    }
    const body = response as { message?: string | string[]; [key: string]: unknown };
    if (Array.isArray(body.message)) {
      return {
        message: 'Les données envoyées sont invalides.',
        details: body.message,
      };
    }
    return { message: body.message ?? fallbackMessage, details: [] };
  }
}
