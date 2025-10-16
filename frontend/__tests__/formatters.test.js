/**
 * Tests básicos para formatters
 */

import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatNumber,
  onlyDigits,
  formatCuit,
  isValidCuit,
  normalize,
  clamp01,
} from '@/lib/utils/formatters';

describe('formatters', () => {
  describe('formatCurrency', () => {
    it('formatea moneda ARS correctamente', () => {
      const result = formatCurrency(1234.56, 'ARS');
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).toContain('56');
    });

    it('formatea moneda USD correctamente', () => {
      const result = formatCurrency(1234.56, 'USD');
      expect(result).toContain('1');
      expect(result).toContain('234');
    });

    it('maneja valores null/undefined', () => {
      expect(formatCurrency(null)).toBeTruthy();
      expect(formatCurrency(undefined)).toBeTruthy();
    });
  });

  describe('formatNumber', () => {
    it('formatea números con separadores', () => {
      const result = formatNumber(1234.56);
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).toContain('56');
    });
  });

  describe('onlyDigits', () => {
    it('extrae solo dígitos de un string', () => {
      expect(onlyDigits('20-12345678-9')).toBe('20123456789');
      expect(onlyDigits('abc123def456')).toBe('123456');
      expect(onlyDigits('12.34')).toBe('1234');
    });

    it('maneja strings vacíos', () => {
      expect(onlyDigits('')).toBe('');
      expect(onlyDigits(null)).toBe('');
    });
  });

  describe('formatCuit', () => {
    it('formatea CUIT con guiones', () => {
      const result = formatCuit('20123456789');
      expect(result).toBe('20-12345678-9');
    });

    it('mantiene formato si no tiene 11 dígitos', () => {
      expect(formatCuit('123')).toBe('123');
      expect(formatCuit('20-12345678-9')).toBe('20-12345678-9');
    });
  });

  describe('isValidCuit', () => {
    it('valida CUIT con 11 dígitos', () => {
      expect(isValidCuit('20123456789')).toBe(true);
      expect(isValidCuit('20-12345678-9')).toBe(true);
    });

    it('rechaza CUIT inválidos', () => {
      expect(isValidCuit('123')).toBe(false);
      expect(isValidCuit('20-1234567-8')).toBe(false);
      expect(isValidCuit('')).toBe(false);
    });
  });

  describe('normalize', () => {
    it('normaliza strings removiendo acentos', () => {
      expect(normalize('José María')).toBe('jose maria');
      expect(normalize('ÑOÑO')).toBe('nono');
      expect(normalize('Café')).toBe('cafe');
    });

    it('convierte a minúsculas', () => {
      expect(normalize('UPPERCASE')).toBe('uppercase');
    });
  });

  describe('clamp01', () => {
    it('limita valores entre 0 y 1', () => {
      expect(clamp01(0.5)).toBe(0.5);
      expect(clamp01(0)).toBe(0);
      expect(clamp01(1)).toBe(1);
    });

    it('limita valores fuera de rango', () => {
      expect(clamp01(-0.5)).toBe(0);
      expect(clamp01(1.5)).toBe(1);
      expect(clamp01(-10)).toBe(0);
      expect(clamp01(10)).toBe(1);
    });
  });
});
