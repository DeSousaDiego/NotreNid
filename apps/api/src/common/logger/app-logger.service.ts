import type { LoggerService } from '@nestjs/common';

interface LogEntry {
  level: string;
  message: string;
  context?: string;
  timestamp: string;
  trace?: string;
}

/**
 * Logger structuré : une ligne JSON par entrée en production (facilement
 * ingérée par un agrégateur de logs), une ligne lisible en développement.
 * Injecté via `app.useLogger()` dans main.ts : toute instance `new Logger(context)`
 * créée ailleurs dans le code (filtres, services, bootstrap Nest) délègue
 * automatiquement à cette implémentation, sans modification de ces call sites.
 */
export class AppLogger implements LoggerService {
  constructor(private readonly isProduction: boolean) {}

  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  private write(level: string, message: unknown, context?: string, trace?: string): void {
    const entry: LogEntry = {
      level,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      context,
      timestamp: new Date().toISOString(),
      trace,
    };

    if (this.isProduction) {
      // Seul point d'écriture des logs applicatifs : une ligne JSON par entrée.
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(entry));
      return;
    }

    const prefix = `[${entry.timestamp}] ${level.toUpperCase()}${context ? ` [${context}]` : ''}`;
    // eslint-disable-next-line no-console
    console.log(`${prefix} ${entry.message}`);
    if (trace) {
      // eslint-disable-next-line no-console
      console.log(trace);
    }
  }
}
