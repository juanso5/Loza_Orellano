import { NextResponse } from "next/server";
import { z } from "zod";
import { assertAuthenticated } from "../../../../lib/authGuard";
import { getSSRClient } from "../../../../lib/supabaseServer";
import { calcularEstadoLiquidez } from "../../../../lib/liquidezHelpers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const getSb = () => getSSRClient();
const SELECT_BASE = `
  id_asignacion,
  cliente_id,
  fondo_id,
  fecha,
  tipo_operacion,
  monto,
  moneda,
  tipo_cambio_usado,
  monto_usd,
  comentario,
  created_at,
  cliente:cliente_id(id_cliente,nombre),
  fondo:fondo_id(id_fondo,tipo_cartera:tipo_cartera_id(descripcion))
`;
function mapRow(r) {
  return {
    id_asignacion: Number(r.id_asignacion),
    cliente_id: Number(r.cliente_id),
    fondo_id: Number(r.fondo_id),
    fecha: typeof r.fecha === "string" ? r.fecha : new Date(r.fecha).toISOString(),
    tipo_operacion: r.tipo_operacion,
    monto: r.monto ? Number(r.monto) : null,
    moneda: r.moneda || "USD",
    tipo_cambio_usado: r.tipo_cambio_usado ? Number(r.tipo_cambio_usado) : null,
    monto_usd: Number(r.monto_usd),
    comentario: r.comentario || "",
    created_at: r.created_at,
    cliente_nombre: r?.cliente?.nombre || null,
    fondo_nombre: r?.fondo?.tipo_cartera?.descripcion || null,
  };
}
const createSchema = z.object({
  cliente_id: z.coerce.number().int().positive(),
  fondo_id: z.coerce.number().int().positive(),
  monto: z.coerce.number().positive(),
  moneda: z.enum(["USD", "ARS"]).default("USD"),
  tipo_cambio_usado: z.coerce.number().positive().optional().nullable(),
  tipo_operacion: z.enum(["asignacion", "desasignacion"]).default("asignacion"),
  comentario: z.string().optional(),
});
// POST - Asignar/desasignar liquidez a fondo
export async function POST(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  try {
    const sb = await getSb();
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { cliente_id, fondo_id, monto, moneda, tipo_cambio_usado, tipo_operacion, comentario } = parsed.data;
    // Calcular monto en USD
    let monto_usd = parseFloat(monto);
    if (moneda === "ARS" && tipo_cambio_usado) {
      monto_usd = monto_usd / parseFloat(tipo_cambio_usado);
    }
    // ✅ VALIDACIÓN CRÍTICA: Validar liquidez disponible para asignaciones
    if (tipo_operacion === "asignacion") {
      const estado = await calcularEstadoLiquidez(sb, cliente_id);
      if (estado.liquidezDisponible < monto_usd) {
        return NextResponse.json({
          success: false,
          error: `Liquidez insuficiente. Disponible: $${estado.liquidezDisponible.toFixed(2)} USD`,
          disponible: estado.liquidezDisponible
        }, { status: 400 });
      }
    }
    // Validar que el fondo pertenezca al cliente
    const { data: fondoData, error: fondoErr } = await sb
      .from("fondo")
      .select("cliente_id")
      .eq("id_fondo", fondo_id)
      .single();
    if (fondoErr || !fondoData) {
      return NextResponse.json({
        success: false,
        error: "Fondo no encontrado"
      }, { status: 404 });
    }
    if (Number(fondoData.cliente_id) !== Number(cliente_id)) {
      return NextResponse.json({
        success: false,
        error: "El fondo no pertenece al cliente especificado"
      }, { status: 403 });
    }
    const insertData = {
      cliente_id: Number(cliente_id),
      fondo_id: Number(fondo_id),
      fecha: new Date().toISOString(),
      tipo_operacion,
      monto: parseFloat(monto),
      moneda,
      tipo_cambio_usado: tipo_cambio_usado ? parseFloat(tipo_cambio_usado) : null,
      monto_usd: parseFloat(monto_usd),
      comentario: comentario || null,
      origen: 'manual',
    };
    const { data, error } = await sb
      .from("asignacion_liquidez")
      .insert(insertData)
      .select(SELECT_BASE)
      .single();
    if (error) throw error;
    return NextResponse.json({
      success: true,
      data: mapRow(data),
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}