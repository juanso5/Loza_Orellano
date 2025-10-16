import { NextResponse } from "next/server";
import { z } from "zod";
import { assertAuthenticated } from "../../../lib/authGuard";
import { getSSRClient } from "../../../lib/supabaseServer";
import { validarExtraccion } from "../../../lib/liquidezHelpers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const getSb = () => getSSRClient();
const SELECT_BASE = `
  id_mov_liq,
  cliente_id,
  fecha,
  tipo_mov,
  monto,
  moneda,
  tipo_cambio_usado,
  monto_usd,
  comentario,
  created_at,
  cliente:cliente_id(id_cliente,nombre)
`;
function mapRow(r) {
  return {
    id_mov_liq: Number(r.id_mov_liq),
    cliente_id: Number(r.cliente_id),
    fecha: typeof r.fecha === "string" ? r.fecha : new Date(r.fecha).toISOString(),
    tipo_mov: r.tipo_mov,
    monto: Number(r.monto),
    moneda: r.moneda,
    tipo_cambio_usado: r.tipo_cambio_usado ? Number(r.tipo_cambio_usado) : null,
    monto_usd: Number(r.monto_usd),
    comentario: r.comentario || "",
    created_at: r.created_at,
    cliente_nombre: r?.cliente?.nombre || null,
  };
}
const createSchema = z.object({
  cliente_id: z.coerce.number().int().positive(),
  fecha: z.string().optional(),
  tipo_mov: z.enum(["deposito", "extraccion"]),
  monto: z.coerce.number().positive(),
  moneda: z.enum(["USD", "ARS"]),
  tipo_cambio_usado: z.coerce.number().positive().optional().nullable(),
  comentario: z.string().optional(),
});
// GET - Obtener movimientos de liquidez
export async function GET(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  try {
    const sb = await getSb();
    const { searchParams } = new URL(req.url);
    const clienteId = searchParams.get("cliente_id");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");
    let query = sb
      .from("mov_liquidez")
      .select(SELECT_BASE, { count: "exact" })
      .order("fecha", { ascending: false })
      .order("id_mov_liq", { ascending: false })
      .range(offset, offset + limit - 1);
    if (clienteId) {
      query = query.eq("cliente_id", clienteId);
    }
    const { data, error, count } = await query;
    if (error) throw error;
    return NextResponse.json({
      success: true,
      data: (data || []).map(mapRow),
      count: count || 0,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}
// POST - Crear movimiento de liquidez
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
    const { cliente_id, tipo_mov, monto, moneda, tipo_cambio_usado, comentario } = parsed.data;
    // Calcular monto en USD
    let monto_usd = parseFloat(monto);
    if (moneda === "ARS" && tipo_cambio_usado) {
      monto_usd = monto_usd / parseFloat(tipo_cambio_usado);
    }
    // Ô£à VALIDACI├ôN CR├ìTICA: Validar extracciones
    if (tipo_mov === "extraccion") {
      const validacion = await validarExtraccion(sb, cliente_id, monto_usd);
      if (!validacion.valido) {
        return NextResponse.json({
          success: false,
          error: validacion.error,
          disponible: validacion.disponible
        }, { status: 400 });
      }
    }
    const insertData = {
      cliente_id: Number(cliente_id),
      fecha: parsed.data.fecha || new Date().toISOString(),
      tipo_mov,
      monto: parseFloat(monto),
      moneda,
      tipo_cambio_usado: tipo_cambio_usado ? parseFloat(tipo_cambio_usado) : null,
      monto_usd,
      comentario: comentario || null,
    };
    const { data, error } = await sb
      .from("mov_liquidez")
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
// DELETE - Eliminar movimiento
export async function DELETE(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  try {
    const sb = await getSb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { success: false, error: "id es requerido" },
        { status: 400 }
      );
    }
    const { error } = await sb
      .from("mov_liquidez")
      .delete()
      .eq("id_mov_liq", parseInt(id));
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}
