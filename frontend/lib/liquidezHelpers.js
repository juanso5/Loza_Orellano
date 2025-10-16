import { createClient } from '@supabase/supabase-js';
/**
 * Helper functions para gesti├│n de liquidez
 */
/**
 * Calcula el estado completo de liquidez de un cliente
 * @param {Object} supabaseClient - Cliente de Supabase
 * @param {number} clienteId - ID del cliente
 * @returns {Promise<{liquidezTotal: number, liquidezAsignada: number, liquidezDisponible: number}>}
 */
export async function calcularEstadoLiquidez(supabaseClient, clienteId) {
  try {
    const { data, error } = await supabaseClient
      .from('v_estado_liquidez')
      .select('liquidez_total, liquidez_asignada, liquidez_disponible')
      .eq('cliente_id', clienteId)
      .single();
    if (error) {
      // Si no hay datos (cliente sin movimientos), devolver 0s
      if (error.code === 'PGRST116') {
        return {
          liquidezTotal: 0,
          liquidezAsignada: 0,
          liquidezDisponible: 0,
        };
      }
      throw error;
    }
    return {
      liquidezTotal: parseFloat(data.liquidez_total || 0),
      liquidezAsignada: parseFloat(data.liquidez_asignada || 0),
      liquidezDisponible: parseFloat(data.liquidez_disponible || 0),
    };
  } catch (error) {
    throw new Error('Error al calcular estado de liquidez: ' + error.message);
  }
}
/**
 * Calcula el estado de un fondo espec├¡fico
 */
export async function calcularEstadoFondo(supabaseClient, clienteId, fondoId) {
  try {
    // 1. Liquidez asignada a este fondo (solo asignaciones manuales)
    const { data: asignaciones, error: errorAsig } = await supabaseClient
      .from('asignacion_liquidez')
      .select('monto_usd, tipo_operacion')
      .eq('cliente_id', clienteId)
      .eq('fondo_id', fondoId)
      .eq('origen', 'manual');
    if (errorAsig) throw errorAsig;
    const liquidezAsignada = (asignaciones || [])
      .reduce((sum, a) => {
        const monto = parseFloat(a.monto_usd || 0);
        return sum + (a.tipo_operacion === 'asignacion' ? monto : -monto);
      }, 0);
    // 2. Dinero gastado en compras
    const { data: compras, error: errorCompras } = await supabaseClient
      .from('movimiento')
      .select('precio_usd, nominal')
      .eq('cliente_id', clienteId)
      .eq('fondo_id', fondoId)
      .eq('tipo_mov', 'compra');
    if (errorCompras) throw errorCompras;
    const dineroEnAcciones = (compras || [])
      .reduce((sum, c) => 
        sum + (parseFloat(c.precio_usd || 0) * parseInt(c.nominal || 0)), 0
      );
    // 3. Dinero recuperado en ventas
    const { data: ventas, error: errorVentas } = await supabaseClient
      .from('movimiento')
      .select('precio_usd, nominal')
      .eq('cliente_id', clienteId)
      .eq('fondo_id', fondoId)
      .eq('tipo_mov', 'venta');
    if (errorVentas) throw errorVentas;
    const dineroRecuperado = (ventas || [])
      .reduce((sum, v) => 
        sum + (parseFloat(v.precio_usd || 0) * parseInt(v.nominal || 0)), 0
      );
    const saldoDisponible = liquidezAsignada - dineroEnAcciones + dineroRecuperado;
    return {
      liquidezAsignada,
      dineroEnAcciones,
      dineroRecuperado,
      saldoDisponible,
      puedeComprar: saldoDisponible > 0,
      porcentajeInvertido: liquidezAsignada > 0 
        ? ((dineroEnAcciones / liquidezAsignada) * 100).toFixed(2) 
        : 0
    };
  } catch (error) {
    throw error;
  }
}
/**
 * Valida si hay suficiente liquidez disponible para asignar
 */
export async function validarLiquidezDisponible(supabaseClient, clienteId, montoAAsignar) {
  const estado = await calcularEstadoLiquidez(supabaseClient, clienteId);
  return {
    valido: estado.liquidezDisponible >= montoAAsignar,
    disponible: estado.liquidezDisponible,
    faltante: Math.max(0, montoAAsignar - estado.liquidezDisponible)
  };
}
/**
 * Valida si un fondo tiene saldo suficiente para una compra
 */
export async function validarSaldoParaCompra(supabaseClient, clienteId, fondoId, montoCompra) {
  const estado = await calcularEstadoFondo(supabaseClient, clienteId, fondoId);
  return {
    valido: estado.saldoDisponible >= montoCompra,
    disponible: estado.saldoDisponible,
    faltante: Math.max(0, montoCompra - estado.saldoDisponible)
  };
}
/**
 * Obtiene el ├║ltimo tipo de cambio registrado
 */
export async function obtenerTipoCambioActual(supabaseClient) {
  try {
    const { data, error } = await supabaseClient
      .from('precio_especie')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(1)
      .single();
    if (error) throw error;
    // Ajusta seg├║n tu tabla de tipo_cambio
    return {
      usd_ars_compra: data?.precio || 1000,
      usd_ars_venta: data?.precio || 1050,
      fecha: data?.fecha
    };
  } catch (error) {
    // Valor por defecto
    return {
      usd_ars_compra: 1000,
      usd_ars_venta: 1050,
      fecha: new Date().toISOString()
    };
  }
}
/**
 * Valida si se puede realizar una extracci├│n
 * @param {Object} supabaseClient - Cliente de Supabase
 * @param {number} clienteId - ID del cliente
 * @param {number} montoUSD - Monto a extraer en USD
 * @returns {Promise<{valido: boolean, disponible: number, error?: string}>}
 */
export async function validarExtraccion(supabaseClient, clienteId, montoUSD) {
  try {
    const estado = await calcularEstadoLiquidez(supabaseClient, clienteId);
    if (montoUSD <= 0) {
      return {
        valido: false,
        disponible: estado.liquidezDisponible,
        error: 'El monto debe ser mayor a 0'
      };
    }
    if (estado.liquidezDisponible < montoUSD) {
      return {
        valido: false,
        disponible: estado.liquidezDisponible,
        error: `Solo hay $${estado.liquidezDisponible.toFixed(2)} USD disponibles para extraer. No puede extraer dinero asignado a fondos.`
      };
    }
    return { 
      valido: true,
      disponible: estado.liquidezDisponible,
      restante: parseFloat((estado.liquidezDisponible - montoUSD).toFixed(2))
    };
  } catch (error) {
    return {
      valido: false,
      error: 'Error al validar: ' + error.message
    };
  }
}
/**
 * Calcula liquidez total del cliente incluyendo lo invertido
 */
export async function calcularPatrimonioTotal(supabaseClient, clienteId) {
  const estadoLiquidez = await calcularEstadoLiquidez(supabaseClient, clienteId);
  // Obtener valor de todas las inversiones
  const { data: fondos } = await supabaseClient
    .from('fondo')
    .select('id_fondo')
    .eq('cliente_id', clienteId);
  let valorInversiones = 0;
  for (const fondo of fondos || []) {
    const estado = await calcularEstadoFondo(supabaseClient, clienteId, fondo.id_fondo);
    valorInversiones += estado.dineroEnAcciones;
  }
  return {
    liquidezDisponible: estadoLiquidez.liquidezDisponible,
    liquidezAsignada: estadoLiquidez.liquidezAsignada,
    valorInversiones,
    patrimonioTotal: estadoLiquidez.liquidezTotal + valorInversiones
  };
}
