import type { LoggerService } from '@nestjs/common';

import { isLevelEnabled, resolveLogThreshold } from './log-level';

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
 *
 * Niveau : LOG_LEVEL (voir log-level.ts). Le logger est créé AVANT le chargement du .env par
 * ConfigModule : le niveau initial vient de process.env, puis main.ts appelle
 * `setLogLevel()` avec la valeur de ConfigService.
 */
export class AppLogger implements LoggerService {
  private threshold: number;

  constructor(
    private readonly isProduction: boolean,
    logLevel: string | undefined = process.env['LOG_LEVEL'],
  ) {
    this.threshold = resolveLogThreshold(logLevel, isProduction);
  }

  setLogLevel(logLevel: string | undefined): void {
    this.threshold = resolveLogThreshold(logLevel, this.isProduction);
  }

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
    if (!isLevelEnabled(level, this.threshold)) {
      return;
    }
    // `Error` (et ses sous-classes) n'ont ni `message` ni `stack` en propriété énumérable :
    // JSON.stringify(error) renvoie systématiquement "{}", masquant silencieusement la cause
    // réelle. Nest lui-même journalise ainsi les erreurs fatales de démarrage (voir
    // @nestjs/core/errors/exception-handler.js : `logger.error(exception)`, sans `trace`
    // séparée) — les extraire explicitement ici est donc nécessaire, pas seulement pour les
    // erreurs applicatives qui passent déjà `trace` en paramètre séparé.
    const resolvedMessage =
      message instanceof Error ? `${message.name}: ${message.message}` : message;
    const resolvedTrace = trace ?? (message instanceof Error ? message.stack : undefined);

    const entry: LogEntry = {
      level,
      message:
        typeof resolvedMessage === 'string' ? resolvedMessage : JSON.stringify(resolvedMessage),
      context,
      timestamp: new Date().toISOString(),
      trace: resolvedTrace,
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
    if (entry.trace) {
      // eslint-disable-next-line no-console
      console.log(entry.trace);
    }
  }
}
