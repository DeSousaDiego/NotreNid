import { AppLogger } from './app-logger.service';

describe('AppLogger', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
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
