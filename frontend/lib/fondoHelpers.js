// lib/fondoHelpers.js
// =====================================================
// HELPERS PARA CALCULOS DE FONDOS
// =====================================================
/**
 * Calcula estado de fondo usando VISTA de DB (100x mas rapido)
 * Ya no hace multiples queries, solo lee la vista pre-calculada
 */
export async function calcularEstadoFondo(supabaseClient, clienteId, fondoId) {
  try {
    const { data, error } = await supabaseClient
      .from('v_estado_fondo')
      .select('liquidez_asignada, dinero_invertido, dinero_recuperado, saldo_disponible')
      .eq('cliente_id', clienteId)
      .eq('id_fondo', fondoId)
      .single();
    if (error) {
      // Si no hay datos (fondo sin asignaciones), devolver 0s
      if (error.code === 'PGRST116') {
        return {
          liquidezAsignada: 0,
          dineroInvertido: 0,
          dineroRecuperado: 0,
          saldoDisponible: 0,
          puedeComprar: false,
          porcentajeInvertido: 0
        };
      }
      throw error;
    }
    const liquidezAsignada = parseFloat(data.liquidez_asignada || 0);
    const dineroInvertido = parseFloat(data.dinero_invertido || 0);
    const dineroRecuperado = parseFloat(data.dinero_recuperado || 0);
    const saldoDisponible = parseFloat(data.saldo_disponible || 0);
    return {
      liquidezAsignada,
      dineroInvertido,
      dineroRecuperado,
      saldoDisponible,
      puedeComprar: saldoDisponible > 0,
      porcentajeInvertido: liquidezAsignada > 0 
        ? parseFloat(((dineroInvertido / liquidezAsignada) * 100).toFixed(2))
        : 0
    };
  } catch (error) {
    throw new Error('Error al calcular estado de fondo: ' + error.message);
  }
}
/**
 * Valida si un fondo tiene saldo suficiente para una compra
 */
export async function validarSaldoParaCompra(supabaseClient, clienteId, fondoId, montoCompra) {
  try {
    if (montoCompra <= 0) {
      return { 
        valido: false, 
        error: 'El monto debe ser mayor a 0' 
      };
    }
    const estado = await calcularEstadoFondo(supabaseClient, clienteId, fondoId);
    if (estado.saldoDisponible < montoCompra) {
      return {
        valido: false,
        disponible: estado.saldoDisponible,
        faltante: parseFloat((montoCompra - estado.saldoDisponible).toFixed(2)),
        error: `El fondo solo tiene $${estado.saldoDisponible.toFixed(2)} USD disponibles. Faltan $${(montoCompra - estado.saldoDisponible).toFixed(2)} USD.`
      };
    }
    return {
      valido: true,
      disponible: estado.saldoDisponible,
      restante: parseFloat((estado.saldoDisponible - montoCompra).toFixed(2))
    };
  } catch (error) {
    return { 
      valido: false, 
      error: 'Error al validar saldo: ' + error.message 
    };
  }
}
/**
 * Funcion legacy - mantener por compatibilidad con codigo antiguo
 */
export async function calcularSaldoFondo(supabaseClient, clienteId, fondoId) {
  const estado = await calcularEstadoFondo(supabaseClient, clienteId, fondoId);
  return estado.saldoDisponible;
}
/**
 * Calcula el progreso de un fondo basado en fecha de alta y plazo
 * Progreso del periodo = (hoy - fecha_alta) / (fecha_alta + plazo - fecha_alta)
 */
export function computeProgress(fechaAlta, tipoPlazo, plazo) {
  if (!fechaAlta || plazo == null) return 0;
  const start = new Date(fechaAlta);
  if (Number.isNaN(start.getTime())) return 0;
  const end = new Date(start);
  const p = Number(plazo) || 0;
  if (p <= 0) return 0;
  if ((tipoPlazo || "").toLowerCase() === "meses") {
    end.setMonth(end.getMonth() + p);
  } else if ((tipoPlazo || "").toLowerCase() === "dias") {
    end.setDate(end.getDate() + p);
  } else {
    return 0;
  }
  const now = new Date();
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 1;
  const elapsed = now.getTime() - start.getTime();
  return Math.max(0, Math.min(1, elapsed / total));
}
/**
 * Calcula el monto firmado segun tipo de movimiento
 * compra|venta -> +|-
 */
export function signedAmount(type, n) {
  return (String(type || "").toLowerCase() === "venta" ? -1 : 1) * (Number(n) || 0);
}
/**
 * Agrega fondos por cartera basandose en movimientos
 * Construye fondos por cartera: [{ id, name, nominal }]
 */
export function aggregateFundsByPortfolio(portfolios, movements) {
  const byPortfolio = new Map(); // pid -> Map(key -> { id, name, nominal })
  for (const m of movements) {
    const pid = Number(m.portfolioId) || null;
    if (!pid) continue;
    const name = (m.fund || "").trim();
    if (!name) continue;
    const delta = signedAmount(m.type, m.amount);
    let map = byPortfolio.get(pid);
    if (!map) {
      map = new Map();
      byPortfolio.set(pid, map);
    }
    // clave por nombre (si hubiera id de especie lo podriamos usar)
    const key = name.toLowerCase();
    const prev = map.get(key) || { id: `n:${key}`, name, nominal: 0 };
    prev.nominal = (Number(prev.nominal) || 0) + delta;
    map.set(key, prev);
  }
  return portfolios.map((p) => {
    const pm = byPortfolio.get(Number(p.id)) || new Map();
    const funds = Array.from(pm.values())
      .filter((f) => Number(f.nominal) > 0)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
    return { ...p, funds };
  });
}
