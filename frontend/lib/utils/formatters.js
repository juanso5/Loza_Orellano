/**
 * Utilidades para formateo de números, moneda y validaciones
 * Centraliza toda la lógica de formato y validación de datos
 */
/**
 * Formatea un monto como moneda
 * @param {number} amount - Monto a formatear
 * @param {string} currency - Código de moneda ('ARS', 'USD', etc.)
 * @param {number} decimals - Cantidad de decimales (default: 2)
 * @returns {string} - Monto formateado con símbolo de moneda
 */
export function formatCurrency(amount, currency = 'ARS', decimals = 2) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount || 0);
}
/**
 * Formatea un número con separadores de miles
 * @param {number} n - Número a formatear
 * @param {number} decimals - Cantidad de decimales (default: 2)
 * @returns {string} - Número formateado
 */
export function formatNumber(n, decimals = 2) {
  return Number(n || 0).toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
/**
 * Extrae solo dígitos de un string
 * @param {string} s - String del cual extraer dígitos
 * @returns {string} - String conteniendo solo dígitos
 */
export function onlyDigits(s = '') {
  return String(s).replace(/\D/g, '');
}
/**
 * Formatea un CUIT con guiones (XX-XXXXXXXX-X)
 * @param {string} cuit - CUIT sin formato
 * @returns {string} - CUIT formateado con guiones
 */
export function formatCuit(cuit) {
  const digits = onlyDigits(cuit);
  if (digits.length !== 11) return cuit || '';
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}
/**
 * Valida si un CUIT tiene formato válido (11 dígitos)
 * @param {string} cuit - CUIT a validar
 * @returns {boolean} - true si el CUIT es válido
 */
export function isValidCuit(cuit) {
  const digits = onlyDigits(cuit);
  return digits.length === 11;
}
/**
 * Normaliza un string para búsqueda (lowercase, sin acentos)
 * @param {string} s - String a normalizar
 * @returns {string} - String normalizado
 */
export function normalize(s = '') {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
/**
 * Crea un formatter ARS reutilizable (para compatibilidad)
 * @returns {Intl.NumberFormat} - Formatter de Intl
 */
export function createARSFormatter() {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  });
}
/**
 * Limita un número entre 0 y 1
 * @param {number} n - Número a limitar
 * @returns {number} - Número entre 0 y 1
 */
export function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}
