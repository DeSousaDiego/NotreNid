import { AppLogger } from './app-logger.service';

describe('AppLogger', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  describe('LOG_LEVEL', () => {
    const emitAll = (logger: AppLogger) => {
      logger.error('e');
      logger.warn('w');
      logger.log('l');
      logger.debug('d');
      logger.verbose('v');
    };
    const emittedLevels = () =>
      logSpy.mock.calls.map((call) => (JSON.parse(call[0] as string) as { level: string }).level);

    it('drops debug and verbose in production when LOG_LEVEL is not set', () => {
      emitAll(new AppLogger(true, undefined));
      expect(emittedLevels()).toEqual(['error', 'warn', 'log']);
    });

    it('allows debug but not verbose in development by default', () => {
      const logger = new AppLogger(false, undefined);
      emitAll(logger);
      expect(logSpy.mock.calls.map((call) => String(call[0]))).toEqual([
        expect.stringContaining('ERROR'),
        expect.stringContaining('WARN'),
        expect.stringContaining('LOG'),
        expect.stringContaining('DEBUG'),
      ]);
    });

    it.each([
      ['error', ['error']],
      ['warn', ['error', 'warn']],
      ['info', ['error', 'warn', 'log']],
      ['debug', ['error', 'warn', 'log', 'debug']],
      ['VERBOSE', ['error', 'warn', 'log', 'debug', 'verbose']],
    ])('honours LOG_LEVEL=%s in production', (level, expected) => {
      emitAll(new AppLogger(true, level));
      expect(emittedLevels()).toEqual(expected);
    });

    it('applies a level set after construction (value read from ConfigService)', () => {
      const logger = new AppLogger(true, undefined);
      logger.setLogLevel('warn');
      emitAll(logger);
      expect(emittedLevels()).toEqual(['error', 'warn']);
    });
  });

  describe('logging an Error instance (production, JSON output)', () => {
    it('serializes name+message instead of "{}" — Error has no enumerable own properties', () => {
      const logger = new AppLogger(true);

      logger.error(new TypeError('Configuration key "DATABASE_URL" does not exist'));

      const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(entry.message).toBe('TypeError: Configuration key "DATABASE_URL" does not exist');
    });

    it('includes the stack trace even when the caller passes no explicit trace argument', () => {
      const logger = new AppLogger(true);
      const error = new Error('boom');

      logger.error(error);

      const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(entry.trace).toBe(error.stack);
    });

    it('prefers an explicitly passed trace over the Error instance stack', () => {
      const logger = new AppLogger(true);

      logger.error(new Error('boom'), 'explicit trace');

      const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(entry.trace).toBe('explicit trace');
    });
  });

  describe('logging an Error instance (development, readable output)', () => {
    it('prints the resolved message and the derived stack trace on separate lines', () => {
      const logger = new AppLogger(false);
      const error = new Error('boom');

      logger.error(error);

      expect(logSpy).toHaveBeenNthCalledWith(1, expect.stringContaining('Error: boom'));
      expect(logSpy).toHaveBeenNthCalledWith(2, error.stack);
    });
  });

  describe('logging a plain string (unaffected by the Error-handling change)', () => {
    it('logs the string as-is in production', () => {
      const logger = new AppLogger(true);

      logger.log('server started');

      const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(entry.message).toBe('server started');
    });
  });
});
