/**
 * Utilidades para manejo de fechas
 * Centraliza toda la lógica de conversión y formateo de fechas
 */
/**
 * Convierte un valor datetime-local a string ISO completo
 * @param {string|Date} val - Fecha en formato YYYY-MM-DDTHH:mm o objeto Date
 * @returns {string|null} - String ISO o null si es inválido
 */
export function toISODateTimeLocal(val) {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
/**
 * Convierte un objeto Date a formato YYYY-MM-DD para input type="date"
 * @param {Date} d - Objeto Date
 * @returns {string} - Fecha en formato YYYY-MM-DD
 */
export function toDateInputValue(d) {
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/**
 * Convierte Date a formato DD-MM-YYYY para display
 * @param {Date} d - Objeto Date
 * @returns {string} - Fecha en formato DD-MM-YYYY
 */
export function toDisplayDMY(d) {
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}
/**
 * Retorna la fecha actual en formato YYYY-MM-DD (local)
 * @returns {string} - Fecha actual en formato YYYY-MM-DD
 */
export function nowLocalDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/**
 * Formatea una fecha ISO a formato español legible
 * Si recibe YYYY-MM-DD, lo trata como fecha local sin conversión UTC
 * @param {string|Date} isoStr - String de fecha en formato ISO o Date
 * @returns {string} - Fecha formateada (ej: "15/01/2025")
 */
export function formatEsDate(isoStr = '') {
  if (!isoStr) return '';
  let d;
  // Si es un string YYYY-MM-DD, parsearlo como fecha local
  if (typeof isoStr === 'string' && isoStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    d = parseDateInput(isoStr);
  } else {
    d = (isoStr instanceof Date) ? isoStr : new Date(isoStr);
  }
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-AR', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  });
}
/**
 * Función auxiliar para padding de 2 dígitos
 * @param {number} n - Número a formatear
 * @returns {string} - Número con padding de 2 dígitos
 */
export function pad2(n) {
  return n.toString().padStart(2, '0');
}
/**
 * Retorna fecha y hora actual en formato datetime-local (YYYY-MM-DDTHH:mm)
 * @returns {string} - Fecha y hora en formato datetime-local
 */
export function getDefaultFecha() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
/**
 * Parse seguro desde YYYY-MM-DD a Date (local)
 * @param {string} v - String en formato YYYY-MM-DD
 * @returns {Date|null} - Objeto Date o null si es inválido
 */
export function parseDateInput(v) {
  if (!v || typeof v !== 'string') return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // Validación básica de rangos
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  // Verificar que la fecha no se "normalizó" (ej: 31 de feb -> 3 de marzo)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}
