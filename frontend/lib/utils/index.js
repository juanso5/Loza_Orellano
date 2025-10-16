/**
 * Barrel export para utilities
 * Permite importar todas las utilities desde un solo lugar
 * 
 * @example
 * import { formatCurrency, formatEsDate, logger } from '@/lib/utils';
 */
// Date utilities
export {
  toISODateTimeLocal,
  toDateInputValue,
  toDisplayDMY,
  nowLocalDate,
  formatEsDate,
  pad2,
  getDefaultFecha,
  parseDateInput,
} from './dateUtils';
// Formatters and validators
export {
  formatCurrency,
  formatNumber,
  onlyDigits,
  formatCuit,
  isValidCuit,
  normalize,
  createARSFormatter,
  clamp01,
} from './formatters';
// Logger
export {
  logger,
  createLogger,
  log,
  LOG_LEVELS,
} from './logger';
