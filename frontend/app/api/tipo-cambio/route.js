import { NextResponse } from "next/server";
import { z } from "zod";
import { assertAuthenticated } from "../../../lib/authGuard";
import { getSSRClient } from "../../../lib/supabaseServer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const getSb = () => getSSRClient();
const SELECT_BASE = "id_tipo_cambio,fecha,usd_ars_compra,usd_ars_venta,created_at";
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// Helper para convertir a ISO del d├¡a
function toIsoStartOfDay(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
// Mapear fila de DB a respuesta
const mapRow = (r) => ({
  id_tipo_cambio: Number(r.id_tipo_cambio),
  fecha: typeof r.fecha === "string" ? r.fecha : new Date(r.fecha).toISOString(),
  usd_ars_compra: Number(r.usd_ars_compra),
  usd_ars_venta: Number(r.usd_ars_venta),
  created_at: r.created_at,
});
// Validaciones
const createSchema = z.object({
  fecha: z.union([ymd, z.string().datetime()]).optional(),
  usd_ars_compra: z.coerce.number().positive(),
  usd_ars_venta: z.coerce.number().positive(),
});
const updateSchema = z.object({
  id: z.coerce.number().int().positive(),
  fecha: z.union([ymd, z.string().datetime()]).optional(),
  usd_ars_compra: z.coerce.number().positive().optional(),
  usd_ars_venta: z.coerce.number().positive().optional(),
});
// GET - Obtener tipos de cambio
export async function GET(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  try {
    const sb = await getSb();
    const { searchParams } = new URL(req.url);
    const fecha = searchParams.get("fecha");
    const latest = searchParams.get("latest") === "true";
    if (latest) {
      // Obtener el tipo de cambio m├ís reciente
      const { data, error } = await sb
        .from("tipo_cambio")
        .select(SELECT_BASE)
        .order("fecha", { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return NextResponse.json({ 
        success: true,
        data: data ? mapRow(data) : null 
      });
    }
    if (fecha) {
      // Obtener tipo de cambio para una fecha espec├¡fica
      const targetDate = toIsoStartOfDay(fecha);
      if (!targetDate) {
        return NextResponse.json({ error: "Fecha inv├ílida" }, { status: 400 });
      }
      const { data, error } = await sb
        .from("tipo_cambio")
        .select(SELECT_BASE)
        .eq("fecha", targetDate.split('T')[0])
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return NextResponse.json({ 
        success: true,
        data: data ? mapRow(data) : null 
      });
    }
    // Obtener todos los tipos de cambio (Ultimos 30 días por defecto)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data, error } = await sb
      .from("tipo_cambio")
      .select(SELECT_BASE)
      .gte("fecha", thirtyDaysAgo.toISOString().split('T')[0])
      .order("fecha", { ascending: false })
      .limit(100);
      if (error) throw error;
    const mapped = (data || []).map(mapRow);
    return NextResponse.json({ success: true, data: mapped });  } catch (e) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Error al obtener tipos de cambio" 
    }, { status: 500 });
  }
}
// POST - Crear/actualizar tipo de cambio
export async function POST(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  try {
    const sb = await getSb();
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.issues?.map(i => 
        `${i.path.join('.')}: ${i.message}`
      ).join('; ');
      return NextResponse.json({ 
        error: `Datos inv├ílidos: ${details}` 
      }, { status: 400 });
    }
    const { fecha, usd_ars_compra, usd_ars_venta } = parsed.data;
    const targetDate = toIsoStartOfDay(fecha) || new Date().toISOString();
    const dateOnly = targetDate.split('T')[0];
    // Verificar si ya existe un tipo de cambio para esta fecha
    const { data: existing } = await sb
      .from("tipo_cambio")
      .select("id_tipo_cambio")
      .eq("fecha", dateOnly)
      .single();
    if (existing) {
      // Actualizar existente
      const { data, error } = await sb
        .from("tipo_cambio")
        .update({
          usd_ars_compra,
          usd_ars_venta,
        })
        .eq("id_tipo_cambio", existing.id_tipo_cambio)
        .select(SELECT_BASE)
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, data: mapRow(data) });
    } else {
      // Crear nuevo
      const { data, error } = await sb
        .from("tipo_cambio")
        .insert({
          fecha: dateOnly,
          usd_ars_compra,
          usd_ars_venta,
        })
        .select(SELECT_BASE)
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, data: mapRow(data) }, { status: 201 });
    }
  } catch (e) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Error al guardar tipo de cambio" 
    }, { status: 500 });
  }
}
// PATCH - Actualizar tipo de cambio
export async function PATCH(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  try {
    const sb = await getSb();
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.issues?.map(i => 
        `${i.path.join('.')}: ${i.message}`
      ).join('; ');
      return NextResponse.json({ 
        error: `Datos inv├ílidos: ${details}` 
      }, { status: 400 });
    }
    const { id, ...updates } = parsed.data;
    const patch = {};
    if (updates.fecha !== undefined) {
      patch.fecha = toIsoStartOfDay(updates.fecha)?.split('T')[0] || updates.fecha;
    }
    if (updates.usd_ars_compra !== undefined) patch.usd_ars_compra = updates.usd_ars_compra;
    if (updates.usd_ars_venta !== undefined) patch.usd_ars_venta = updates.usd_ars_venta;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
    }
    const { data, error } = await sb
      .from("tipo_cambio")
      .update(patch)
      .eq("id_tipo_cambio", id)
      .select(SELECT_BASE)
      .single();
    if (error) throw error;
    return NextResponse.json({ data: mapRow(data) });
  } catch (e) {
    return NextResponse.json({ 
      error: e?.message || "Error al actualizar tipo de cambio" 
    }, { status: 500 });
  }
}
// DELETE - Eliminar tipo de cambio
export async function DELETE(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  try {
    const sb = await getSb();
    const body = await req.json().catch(() => ({}));
    const parsed = z.object({ 
      id: z.coerce.number().int().positive() 
    }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Falta id v├ílido" }, { status: 400 });
    }
    const { error } = await sb
      .from("tipo_cambio")
      .delete()
      .eq("id_tipo_cambio", parsed.data.id);
    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ 
      error: "Error al eliminar tipo de cambio" 
    }, { status: 500 });
  }
}
