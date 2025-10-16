// Tipos base
export type TipoMoneda = 'ARS' | 'USD';
export type TipoEstrategia = 'jubilacion' | 'viajes' | 'largo_plazo' | 'objetivo';

// Metadata por estrategia
export interface MetadataJubilacion {
  estrategia: 'jubilacion';
  anos: number;
  comentario?: string;
}

export interface MetadataViajes {
  estrategia: 'viajes';
  monto_objetivo: number;
  moneda: TipoMoneda;
  comentario?: string;
}

export interface MetadataLargoPlazo {
  estrategia: 'largo_plazo';
  comentario?: string;
}

export interface MetadataObjetivo {
  estrategia: 'objetivo';
  fecha_objetivo: string;
  monto_objetivo: number;
  moneda: TipoMoneda;
  comentario?: string;
}

export type FondoMetadata = 
  | MetadataJubilacion 
  | MetadataViajes 
  | MetadataLargoPlazo 
  | MetadataObjetivo;

// Estructura principal de un fondo
export interface Fondo {
  id_fondo: number;
  cliente_id: number;
  tipo_cartera_id: number;
  fecha_alta: string;
  rend_esperado: number | null;
  metadata: FondoMetadata;
  categoria: string;
  nombre_cartera: string;
  liquidez_asignada: number;
  dinero_invertido: number;
  saldo_disponible: number;
  valor_total_fondo: number;
  rendimiento_real: number;
  progreso_porcentaje: number;
}

// Movimientos
export interface MovimientoFondo {
  id_mov_liq: number;
  fondo_id: number;
  fecha: string;
  tipo_mov: 'deposito' | 'extraccion';
  monto: number;
  moneda: TipoMoneda;
  monto_usd: number;
  comentario?: string;
}

// Estado del fondo
export interface EstadoFondo {
  liquidez_asignada: number;
  dinero_invertido: number;
  dinero_recuperado: number;
  saldo_disponible: number;
  puedeComprar: boolean;
  porcentajeInvertido: number;
}

// Rendimiento del fondo
export interface RendimientoFondo {
  capital_neto: number;
  saldo_disponible: number;
  total_compras: number;
  total_ventas: number;
  acciones_cantidad: number;
  inversion_actual: number;
  valor_total_fondo: number;
  ganancia_nominal: number;
  rendimiento_porcentaje: number;
}