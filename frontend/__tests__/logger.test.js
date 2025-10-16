/**
 * Tests para logger utility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger, createLogger, log, LOG_LEVELS } from '@/lib/utils/logger';

describe('Logger', () => {
  beforeEach(() => {
    // Reset console mocks
    vi.clearAllMocks();
  });

  describe('logger instance', () => {
    it('debe existir logger por defecto', () => {
      expect(logger).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
    });

    it('debe tener todos los métodos', () => {
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.group).toBe('function');
      expect(typeof logger.time).toBe('function');
      expect(typeof logger.timeEnd).toBe('function');
      expect(typeof logger.table).toBe('function');
    });
  });

  describe('createLogger', () => {
    it('debe crear logger con contexto', () => {
      const contextLogger = createLogger('TestContext');
      expect(contextLogger).toBeDefined();
      expect(contextLogger.context).toBe('TestContext');
    });

    it('debe crear múltiples loggers con diferentes contextos', () => {
      const logger1 = createLogger('Context1');
      const logger2 = createLogger('Context2');
      
      expect(logger1.context).toBe('Context1');
      expect(logger2.context).toBe('Context2');
    });
  });

  describe('log object', () => {
    it('debe tener shortcuts para todos los métodos', () => {
      expect(typeof log.debug).toBe('function');
      expect(typeof log.info).toBe('function');
      expect(typeof log.warn).toBe('function');
      expect(typeof log.error).toBe('function');
      expect(typeof log.group).toBe('function');
      expect(typeof log.time).toBe('function');
      expect(typeof log.timeEnd).toBe('function');
      expect(typeof log.table).toBe('function');
    });
  });

  describe('LOG_LEVELS', () => {
    it('debe tener todos los niveles definidos', () => {
      expect(LOG_LEVELS.DEBUG).toBe('debug');
      expect(LOG_LEVELS.INFO).toBe('info');
      expect(LOG_LEVELS.WARN).toBe('warn');
      expect(LOG_LEVELS.ERROR).toBe('error');
    });
  });

  describe('métodos del logger', () => {
    it('debug debe funcionar sin errores', () => {
      expect(() => {
        logger.debug('Test message', { data: 'test' });
      }).not.toThrow();
    });

    it('info debe funcionar sin errores', () => {
      expect(() => {
        logger.info('Test message', { data: 'test' });
      }).not.toThrow();
    });

    it('warn debe funcionar sin errores', () => {
      expect(() => {
        logger.warn('Test warning', { data: 'test' });
      }).not.toThrow();
    });

    it('error debe funcionar sin errores', () => {
      expect(() => {
        logger.error('Test error', new Error('Test'));
      }).not.toThrow();
    });

    it('time/timeEnd debe funcionar sin errores', () => {
      expect(() => {
        logger.time('test-timer');
        logger.timeEnd('test-timer');
      }).not.toThrow();
    });

    it('group debe funcionar sin errores', () => {
      expect(() => {
        logger.group('Test Group', () => {
          logger.info('Inside group');
        });
      }).not.toThrow();
    });

    it('table debe funcionar sin errores', () => {
      expect(() => {
        logger.table([{ a: 1, b: 2 }, { a: 3, b: 4 }]);
      }).not.toThrow();
    });
  });

  describe('logger con contexto', () => {
    it('debe incluir contexto en los mensajes', () => {
      const contextLogger = createLogger('MyContext');
      
      expect(() => {
        contextLogger.debug('Test message');
        contextLogger.info('Test message');
        contextLogger.warn('Test message');
        contextLogger.error('Test message');
      }).not.toThrow();
    });
  });
});
