import { NextResponse } from "next/server";
import { assertAuthenticated } from "../../../../lib/authGuard";
import { getSSRClient } from "../../../../lib/supabaseServer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const getSb = () => getSSRClient();
/**
 * GET /api/liquidez/estado?cliente_id=X
 * Calcula el estado completo de liquidez usando las vistas optimizadas
 */
export async function GET(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  try {
    const sb = await getSb();
    const { searchParams } = new URL(req.url);
    const clienteId = searchParams.get("cliente_id");
    if (!clienteId) {
      return NextResponse.json(
        { success: false, error: "cliente_id es requerido" },
        { status: 400 }
      );
    }
    // 1. Obtener estado de liquidez desde la vista
    const { data: estadoData, error: estadoError } = await sb
      .from("v_estado_liquidez")
      .select("liquidez_total, liquidez_asignada, liquidez_disponible")
      .eq("cliente_id", clienteId)
      .single();
    // Si no hay datos, el cliente no tiene movimientos aún
    const estado =
      estadoError?.code === "PGRST116"
        ? { liquidez_total: 0, liquidez_asignada: 0, liquidez_disponible: 0 }
        : estadoData;
    if (estadoError && estadoError.code !== "PGRST116") {
      return NextResponse.json(
        { success: false, error: estadoError.message },
        { status: 500 }
      );
    }
    // 2. Obtener fondos del cliente
    const { data: fondos, error: fondosError } = await sb
      .from("fondo")
      .select(`
        id_fondo,
        nombre,
        tipo_cartera_id,
        plazo,
        tipo_plazo,
        rend_esperado,
        deposito_inicial,
        fecha_alta,
        tipo_cartera:tipo_cartera_id(descripcion, color, icono)
      `)
      .eq("cliente_id", clienteId);
    if (fondosError) {
      return NextResponse.json(
        { success: false, error: fondosError.message },
        { status: 500 }
      );
    }
    // 3. Obtener estado de TODOS los fondos en una sola query
    const { data: estadosFondo, error: errorEstados } = await sb
      .from("v_estado_fondo")
      .select("id_fondo, liquidez_asignada, dinero_invertido, dinero_recuperado, saldo_disponible")
      .eq("cliente_id", clienteId);
    if (errorEstados) {
      }
    // Crear un Map para lookup rápido
    const estadosMap = new Map(
      (estadosFondo || []).map(ef => [Number(ef.id_fondo), ef])
    );
    // Mapear fondos con su estado
    const fondosConEstado = (fondos || []).map((fondo) => {
      const estadoFondo = estadosMap.get(Number(fondo.id_fondo)) || {
        liquidez_asignada: 0,
        dinero_invertido: 0,
        dinero_recuperado: 0,
        saldo_disponible: 0,
      };
      const liquidezAsignada = parseFloat(estadoFondo.liquidez_asignada || 0);
      const dineroInvertido = parseFloat(estadoFondo.dinero_invertido || 0);
      return {
        id_fondo: fondo.id_fondo,
        nombre: fondo.nombre,
        tipo_cartera_id: fondo.tipo_cartera_id,
        tipo_cartera: {
          descripcion: fondo.tipo_cartera?.descripcion || "N/A",
          color: fondo.tipo_cartera?.color || "#3b82f6",
          icono: fondo.tipo_cartera?.icono || "📊"
        },
        plazo: fondo.plazo,
        tipo_plazo: fondo.tipo_plazo,
        rend_esperado: fondo.rend_esperado,
        deposito_inicial: fondo.deposito_inicial,
        fecha_alta: fondo.fecha_alta,
        liquidezAsignada: liquidezAsignada,
        dineroInvertido: dineroInvertido,
        dineroRecuperado: parseFloat(estadoFondo.dinero_recuperado || 0),
        saldoDisponible: parseFloat(estadoFondo.saldo_disponible || 0),
        puedeComprar: parseFloat(estadoFondo.saldo_disponible || 0) > 0,
        porcentajeInvertido:
          liquidezAsignada > 0
            ? parseFloat(((dineroInvertido / liquidezAsignada) * 100).toFixed(2))
            : 0,
      };
    });
    return NextResponse.json({
      success: true,
      data: {
        liquidezTotal: parseFloat(estado.liquidez_total || 0),
        liquidezAsignada: parseFloat(estado.liquidez_asignada || 0),
        liquidezDisponible: parseFloat(estado.liquidez_disponible || 0),
        fondos: fondosConEstado,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e.message || "Error al calcular estado de liquidez" },
      { status: 500 }
    );
  }
}