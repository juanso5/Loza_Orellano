import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getSb = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase no configurado");
  return createClient(url, key, { auth: { persistSession: false } });
};

const SELECT_BASE =
  "id_movimiento,cliente_id,fondo_id,fecha_alta,precio_usd,tipo_mov,nominal,tipo_especie_id," +
  "tipo_especie:tipo_especie_id(id_tipo_especie,nombre)," +
  "cliente:cliente_id(id_cliente,nombre)," +
  "fondo:fondo_id(id_fondo,tipo_cartera:tipo_cartera_id(id_tipo_cartera,descripcion))";

const ALLOWED_ORDER = new Set([
  "id_movimiento",
  "cliente_id",
  "fondo_id",
  "fecha_alta",
  "precio_usd",
  "tipo_mov",
  "nominal",
  "tipo_especie_id",
]);

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const toIsoStartOfDay = (v) => {
  if (!v) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00.000Z`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const toIsoEndOfDay = (v) => {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) {
    const d = new Date(`${v}T00:00:00.000Z`);
    d.setUTCHours(23, 59, 59, 999);
    return d.toISOString();
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
};

const mapRow = (r) => ({
  id_movimiento: Number(r.id_movimiento),
  cliente_id: Number(r.cliente_id),
  fondo_id: Number(r.fondo_id),
  fecha_alta: typeof r.fecha_alta === "string" ? r.fecha_alta : new Date(r.fecha_alta).toISOString(),
  precio_usd: r.precio_usd == null ? null : Number(r.precio_usd),
  tipo_mov: r.tipo_mov,
  nominal: Number(r.nominal),
  tipo_especie_id: r.tipo_especie_id == null ? null : Number(r.tipo_especie_id),
  especie: r?.tipo_especie?.nombre ?? null,
  cliente_nombre: r?.cliente?.nombre ?? null,
  cartera_nombre: r?.fondo?.tipo_cartera?.descripcion ?? null,
});

const createSchema = z.object({
  cliente_id: z.coerce.number().int().positive(),
  fondo_id: z.coerce.number().int().positive(),
  fecha_alta: z.union([ymd, z.string().datetime().optional()]).optional(),
  tipo_mov: z.enum(["compra", "venta"]),
  nominal: z.coerce.number().int().positive(),
  precio_usd: z.coerce.number().optional().nullable(),
  tipo_especie_id: z.coerce.number().int().positive().optional(),
  especie: z.string().min(1).optional(),
});

const updateSchema = z.object({
  id: z.coerce.number().int().positive(),
  cliente_id: z.coerce.number().int().positive().optional(),
  fondo_id: z.coerce.number().int().positive().optional(),
  fecha_alta: z.union([ymd, z.string().datetime()]).optional(),
  tipo_mov: z.enum(["compra", "venta"]).optional(),
  nominal: z.coerce.number().int().positive().optional(),
  precio_usd: z.coerce.number().optional().nullable(),
  tipo_especie_id: z.coerce.number().int().positive().optional(),
  especie: z.string().min(1).optional(),
});

const deleteSchema = z.object({ id: z.coerce.number().int().positive() });

// Esquema para upsert de precios desde CSV (sin moneda)
const upsertPreciosSchema = z.object({
  action: z.literal("upsertPrecios"),
  fecha: z.union([ymd, z.string().datetime()]),
  fuente: z.string().optional(),
  items: z.array(
    z.object({
      instrumento: z.string().min(1),
      precio: z.coerce.number().positive(),
    })
  ).min(1),
});

async function assertFondoBelongs(sb, fondoId, clienteId) {
  const { data, error } = await sb
    .from("fondo")
    .select("id_fondo,cliente_id")
    .eq("id_fondo", fondoId)
    .single();
  if (error) throw error;
  if (!data || Number(data.cliente_id) !== Number(clienteId)) {
    const err = new Error("El fondo no pertenece al cliente indicado");
    err.status = 400;
    throw err;
  }
}

async function resolveTipoEspecieId(sb, maybeId, maybeName) {
  if (maybeId) return Number(maybeId);
  const name = (maybeName || "").trim();
  if (!name) {
    const err = new Error("Debe indicar tipo_especie_id o nombre de especie");
    err.status = 400;
    throw err;
  }
  const found = await sb
    .from("tipo_especie")
    .select("id_tipo_especie,nombre")
    .ilike("nombre", name)
    .limit(1);
  if (found.error) throw found.error;

  if (found.data?.[0]) return Number(found.data[0].id_tipo_especie);

  const ins = await sb
    .from("tipo_especie")
    .insert({ nombre: name })
    .select("id_tipo_especie")
    .single();
  if (ins.error) throw ins.error;
  return Number(ins.data.id_tipo_especie);
}

async function computeDisponible(sb, cliente_id, fondo_id, tipo_especie_id, fecha_alta) {
  const end = fecha_alta ? toIsoEndOfDay(fecha_alta) : null;
  let q = sb
    .from("movimiento")
    .select("tipo_mov,nominal")
    .eq("cliente_id", cliente_id)
    .eq("fondo_id", fondo_id)
    .eq("tipo_especie_id", tipo_especie_id);
  if (end) q = q.lte("fecha_alta", end);
  const { data, error } = await q.limit(10000);
  if (error) throw error;
  let disponible = 0;
  for (const r of data || []) {
    const n = Number(r.nominal) || 0;
    disponible += r.tipo_mov === "venta" ? -n : n;
  }
  return disponible;
}

// GET
export async function GET(req) {
  try {
    const sb = getSb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const clienteId = searchParams.get("cliente_id");
    const fondoId = searchParams.get("fondo_id");
    const especieId = searchParams.get("tipo_especie_id");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = parseInt(searchParams.get("limit") ?? "500", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);
    const reqOrderBy = searchParams.get("orderBy") ?? "fecha_alta";
    const orderBy = ALLOWED_ORDER.has(reqOrderBy) ? reqOrderBy : "fecha_alta";
    const orderAsc = (searchParams.get("orderDir") ?? "asc").toLowerCase() !== "desc";

    let q = sb.from("movimiento").select(SELECT_BASE);

    if (id) {
      const { data, error } = await q.eq("id_movimiento", id).single();
      if (error) throw error;
      return NextResponse.json({ data: mapRow(data) });
    }

    if (clienteId) q = q.eq("cliente_id", clienteId);
    if (fondoId) q = q.eq("fondo_id", fondoId);
    if (especieId) q = q.eq("tipo_especie_id", especieId);

    if (from) {
      const isoFrom = toIsoStartOfDay(from);
      if (isoFrom) q = q.gte("fecha_alta", isoFrom);
    }
    if (to) {
      const isoTo = toIsoEndOfDay(to);
      if (isoTo) q = q.lte("fecha_alta", isoTo);
    }

    q = q.order(orderBy, { ascending: orderAsc }).order("id_movimiento", { ascending: true });

    if (Number.isFinite(limit) && Number.isFinite(offset))
      q = q.range(offset, offset + limit - 1);

    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({ data: (data || []).map(mapRow) });
  } catch (e) {
    console.error("GET /api/movimiento error:", e);
    const status = e?.status || 500;
    return NextResponse.json({ error: "Error al obtener movimientos" }, { status });
  }
}

// POST
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    // Acción: upsert de precios desde CSV (sin moneda)
    if (body?.action === "upsertPrecios") {
      const parsed = upsertPreciosSchema.safeParse(body);
      if (!parsed.success) {
        const errText = parsed.error?.issues?.map(i => i.message).join("; ") || "Datos inválidos";
        return NextResponse.json({ error: errText, details: parsed.error.flatten() }, { status: 400 });
      }
      const sb = getSb();
      const fechaIso = toIsoStartOfDay(parsed.data.fecha) || new Date().toISOString();

      const rows = [];
      for (const it of parsed.data.items) {
        const tipoEspecieId = await resolveTipoEspecieId(sb, null, it.instrumento);
        rows.push({
          tipo_especie_id: tipoEspecieId,
          fecha: fechaIso,
          precio: it.precio,
        });
      }

      // Upsert por (tipo_especie_id, fecha)
      let up = await sb
        .from("precio_especie")
        .upsert(rows, { onConflict: "tipo_especie_id,fecha" })
        .select("id_precio_especie,tipo_especie_id,fecha,precio");
      if (up.error?.message?.toLowerCase?.().includes("on conflict")) {
        up = await sb
          .from("precio_especie")
          .insert(rows)
          .select("id_precio_especie,tipo_especie_id,fecha,precio");
      }
      if (up.error) throw up.error;

      return NextResponse.json({ data: up.data || rows, saved: rows.length }, { status: 201 });
    }

    // Alta de movimiento (sin cambios)
    const parsed = z.object({
      cliente_id: z.coerce.number().int().positive(),
      fondo_id: z.coerce.number().int().positive(),
      fecha_alta: z.union([ymd, z.string().datetime().optional()]).optional(),
      tipo_mov: z.enum(["compra", "venta"]),
      nominal: z.coerce.number().int().positive(),
      precio_usd: z.coerce.number().optional().nullable(),
      tipo_especie_id: z.coerce.number().int().positive().optional(),
      especie: z.string().min(1).optional(),
    }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const {
      cliente_id,
      fondo_id,
      fecha_alta,
      tipo_mov,
      nominal,
      precio_usd,
      tipo_especie_id,
      especie,
    } = parsed.data;

    const sb = getSb();

    await assertFondoBelongs(sb, fondo_id, cliente_id);
    const especieId = await resolveTipoEspecieId(sb, tipo_especie_id, especie);

    if (tipo_mov === "venta") {
      const disponible = await computeDisponible(sb, cliente_id, fondo_id, especieId, fecha_alta);
      if (nominal > disponible) {
        return NextResponse.json(
          { error: `No hay suficiente disponible. Disponible: ${disponible}` },
          { status: 400 }
        );
      }
    }

    const payload = {
      cliente_id,
      fondo_id,
      fecha_alta: toIsoStartOfDay(fecha_alta) || new Date().toISOString(),
      tipo_mov,
      nominal,
      precio_usd: precio_usd ?? null,
      tipo_especie_id: especieId,
    };

    const { data, error } = await sb
      .from("movimiento")
      .insert(payload)
      .select(SELECT_BASE)
      .single();
    if (error) throw error;

    return NextResponse.json({ data: mapRow(data) }, { status: 201 });
  } catch (e) {
    console.error("POST /api/movimiento error:", e);
    const status = e?.status || 500;
    return NextResponse.json({ error: e.message || "Error al crear movimiento" }, { status });
  }
}

// PATCH (sin cambios)
export async function PATCH(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = z.object({
      id: z.coerce.number().int().positive(),
      cliente_id: z.coerce.number().int().positive().optional(),
      fondo_id: z.coerce.number().int().positive().optional(),
      fecha_alta: z.union([ymd, z.string().datetime()]).optional(),
      tipo_mov: z.enum(["compra", "venta"]).optional(),
      nominal: z.coerce.number().int().positive().optional(),
      precio_usd: z.coerce.number().optional().nullable(),
      tipo_especie_id: z.coerce.number().int().positive().optional(),
      especie: z.string().min(1).optional(),
    }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const {
      id,
      cliente_id,
      fondo_id,
      fecha_alta,
      tipo_mov,
      nominal,
      precio_usd,
      tipo_especie_id,
      especie,
    } = parsed.data;

    const sb = getSb();
    const patch = {};

    if (cliente_id != null) patch.cliente_id = cliente_id;
    if (fondo_id != null) patch.fondo_id = fondo_id;
    if (fecha_alta != null) patch.fecha_alta = toIsoStartOfDay(fecha_alta);
    if (tipo_mov != null) patch.tipo_mov = tipo_mov;
    if (nominal != null) patch.nominal = nominal;
    if (precio_usd !== undefined) patch.precio_usd = precio_usd ?? null;

    if (tipo_especie_id != null || especie != null) {
      patch.tipo_especie_id = await resolveTipoEspecieId(sb, tipo_especie_id, especie);
    }

    if (patch.fondo_id != null || patch.cliente_id != null) {
      const cId = patch.cliente_id ?? cliente_id;
      const fId = patch.fondo_id ?? fondo_id;
      if (cId && fId) await assertFondoBelongs(sb, fId, cId);
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
    }

    const { data, error } = await sb
      .from("movimiento")
      .update(patch)
      .eq("id_movimiento", id)
      .select(SELECT_BASE)
      .single();
    if (error) throw error;

    return NextResponse.json({ data: mapRow(data) });
  } catch (e) {
    console.error("PATCH /api/movimiento error:", e);
    const status = e?.status || 500;
    return NextResponse.json({ error: e.message || "Error al actualizar movimiento" }, { status });
  }
}

// DELETE (sin cambios)
export async function DELETE(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = z.object({ id: z.coerce.number().int().positive() }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Falta id válido" }, { status: 400 });
    }

    const sb = getSb();
    const { error } = await sb.from("movimiento").delete().eq("id_movimiento", parsed.data.id);
    if (error) throw error;

    return new Response(null, { status: 204 });
  } catch (e) {
    console.error("DELETE /api/movimiento error:", e);
    return NextResponse.json({ error: "Error al eliminar movimiento" }, { status: 500 });
  }
}