/**
 * Logger utility - Production-safe logging
 * Reemplaza console.log con logging condicional basado en ambiente
 */
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
/**
 * Niveles de log
 */
export const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
};
/**
 * Formatea el mensaje con timestamp y contexto
 */
function formatMessage(level, context, message, data) {
  const timestamp = new Date().toISOString();
  const contextStr = context ? `[${context}]` : '';
  return {
    timestamp,
    level,
    context,
    message,
    data,
    formatted: `${timestamp} ${level.toUpperCase()} ${contextStr} ${message}`,
  };
}
/**
 * Logger class
 */
class Logger {
  constructor(context = '') {
    this.context = context;
  }
  /**
   * Log de debug - solo en desarrollo
   */
  debug(message, data) {
    if (isDevelopment) {
      const formatted = formatMessage(LOG_LEVELS.DEBUG, this.context, message, data);
      }
  }
  /**
   * Log de info - solo en desarrollo
   */
  info(message, data) {
    if (isDevelopment) {
      const formatted = formatMessage(LOG_LEVELS.INFO, this.context, message, data);
      }
  }
  /**
   * Log de warning - siempre
   */
  warn(message, data) {
    const formatted = formatMessage(LOG_LEVELS.WARN, this.context, message, data);
    }
  /**
   * Log de error - siempre
   */
  error(message, error) {
    const formatted = formatMessage(LOG_LEVELS.ERROR, this.context, message, error);
    // En producción, aquí podrías enviar a servicio de logging
    // if (!isDevelopment) {
    //   sendToLoggingService(formatted);
    // }
  }
  /**
   * Grupo de logs (para agrupar logs relacionados)
   */
  group(label, callback) {
    if (isDevelopment) {
      console.group(label);
      callback();
      console.groupEnd();
    }
  }
  /**
   * Tiempo de ejecución
   */
  time(label) {
    if (isDevelopment) {
      console.time(label);
    }
  }
  timeEnd(label) {
    if (isDevelopment) {
      console.timeEnd(label);
    }
  }
  /**
   * Tabla (útil para arrays de objetos)
   */
  table(data) {
    if (isDevelopment) {
      console.table(data);
    }
  }
}
/**
 * Logger por defecto (sin contexto)
 */
export const logger = new Logger();
/**
 * Crear logger con contexto específico
 * @param {string} context - Contexto del logger (ej: 'AppDataProvider', 'API')
 * @returns {Logger}
 * 
 * @example
 * const log = createLogger('ClientesPage');
 * log.debug('Cargando clientes', { count: 10 });
 */
export function createLogger(context) {
  return new Logger(context);
}
/**
 * Exports individuales para compatibilidad
 */
export const log = {
  debug: (message, data) => logger.debug(message, data),
  info: (message, data) => logger.info(message, data),
  warn: (message, data) => logger.warn(message, data),
  error: (message, error) => logger.error(message, error),
  group: (label, callback) => logger.group(label, callback),
  time: (label) => logger.time(label),
  timeEnd: (label) => logger.timeEnd(label),
  table: (data) => logger.table(data),
};
export default logger;
