import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { assertAllowedUser } from "../../../lib/authGuard"; // <-- agregar

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getSb = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase no configurado");
  return createClient(url, key, { auth: { persistSession: false } });
};

const SELECT_BASE =
  "id_fondo,cliente_id,tipo_cartera:tipo_cartera_id(id_tipo_cartera,descripcion),plazo,tipo_plazo,fecha_alta,rend_esperado,deposito_inicial";

function toYMD(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function mapRow(r) {
  const fecha =
    typeof r.fecha_alta === "string"
      ? r.fecha_alta
      : r.fecha_alta
      ? toYMD(r.fecha_alta)
      : null;

  const out = {
    id: Number(r.id_fondo),
    clienteId: r.cliente_id == null ? null : Number(r.cliente_id),
    tipoCarteraId:
      r?.tipo_cartera?.id_tipo_cartera != null
        ? Number(r.tipo_cartera.id_tipo_cartera)
        : r?.tipo_cartera_id != null
        ? Number(r.tipo_cartera_id)
        : null,
    plazo: r.plazo == null ? null : Number(r.plazo),
    tipoPlazo: r.tipo_plazo ?? null,
    fechaAlta: fecha,
    rendEsperado: r.rend_esperado == null ? null : Number(r.rend_esperado),
    depositoInicial: r.deposito_inicial == null ? null : Number(r.deposito_inicial),
  };
  if (r.tipo_cartera) out.tipo_cartera = r.tipo_cartera;
  return out;
}

// Validaciones
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable();
const createSchema = z
  .object({
    cliente_id: z.coerce.number().int().positive(),
    tipo_cartera_id: z.coerce.number().int().positive().optional(),
    name: z.string().min(1).optional(),
    tipo_cartera: z.string().min(1).optional(),
    descripcion: z.string().min(1).optional(),
    periodMonths: z.coerce.number().int().min(0).optional().nullable(),
    plazo: z.coerce.number().int().min(0).optional().nullable(),
    tipo_plazo: z.enum(["dias", "meses"]).optional().nullable(),
    fecha_alta: ymd,
    rend_esperado: z.coerce.number().optional().nullable(),
    deposito_inicial: z.coerce.number().optional().nullable(),
  })
  .passthrough();

const updateSchema = z.object({
  id: z.coerce.number().int().positive(),
  cliente_id: z.coerce.number().int().positive().optional(),
  tipo_cartera_id: z.coerce.number().int().positive().optional(),
  plazo: z.coerce.number().int().min(0).optional().nullable(),
  tipo_plazo: z.enum(["dias", "meses"]).optional().nullable(),
  fecha_alta: ymd,
  rend_esperado: z.coerce.number().optional().nullable(),
  deposito_inicial: z.coerce.number().optional().nullable(),
});
const deleteSchema = z.object({ id: z.coerce.number().int().positive() });

export async function GET(req) {
  const auth = await assertAllowedUser(req); // <-- agregar
  if (!auth.ok) return auth.res;            // <-- agregar
  try {
    const supabase = getSb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const clienteId = searchParams.get("cliente_id");
    const tipoCarteraId = searchParams.get("tipo_cartera_id");
    const limit = parseInt(searchParams.get("limit") ?? "100", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);
    const orderBy = searchParams.get("orderBy") ?? "id_fondo";
    const orderAsc = (searchParams.get("orderDir") ?? "asc").toLowerCase() !== "desc";
    const select = searchParams.get("select") || SELECT_BASE;

    let q = supabase.from("fondo").select(select).order(orderBy, { ascending: orderAsc });

    if (id) {
      const { data, error } = await q.eq("id_fondo", id).single();
      if (error) throw error;
      return NextResponse.json({ data: mapRow(data) });
    }

    if (clienteId) q = q.eq("cliente_id", clienteId);
    if (tipoCarteraId) q = q.eq("tipo_cartera_id", tipoCarteraId);
    if (Number.isFinite(limit) && Number.isFinite(offset)) q = q.range(offset, offset + limit - 1);

    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ data: (data || []).map(mapRow) });
  } catch (e) {
    console.error("GET /api/fondo error:", e);
    return NextResponse.json({ error: "Error al obtener fondos" }, { status: 500 });
  }
}

// POST /api/fondo
export async function POST(req) {
  const auth = await assertAllowedUser(req); // <-- agregar
  if (!auth.ok) return auth.res;            // <-- agregar
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const sb = getSb();
    const {
      cliente_id,
      tipo_cartera_id,
      name,
      tipo_cartera,
      descripcion,
      periodMonths,
      plazo,
      tipo_plazo,
      fecha_alta,
      rend_esperado,
      deposito_inicial,
    } = parsed.data;

    let tipoId = tipo_cartera_id ?? null;
    const nombreTipo = (name || tipo_cartera || descripcion || "").toString().trim();

    // Buscar/crear tipo_cartera sin usar single/maybeSingle (para evitar errores por 0 o N filas)
    if (!tipoId) {
      if (!nombreTipo) {
        return NextResponse.json(
          { error: "Debe enviar tipo_cartera_id o un nombre (name/tipo_cartera/descripcion)" },
          { status: 400 }
        );
      }
      const found = await sb
        .from("tipo_cartera")
        .select("id_tipo_cartera,descripcion")
        .ilike("descripcion", nombreTipo)
        .limit(1);
      if (found.error) throw found.error;
      let tipo = found.data?.[0] ?? null;
      if (!tipo) {
        const ins = await sb
          .from("tipo_cartera")
          .insert({ descripcion: nombreTipo })
          .select("id_tipo_cartera,descripcion")
          .single();
        if (ins.error) throw ins.error;
        tipo = ins.data;
      }
      tipoId = Number(tipo.id_tipo_cartera);
    }

    const payloadPlazo =
      periodMonths != null
        ? { plazo: Number(periodMonths), tipo_plazo: "meses" }
        : {
            plazo: plazo ?? null,
            tipo_plazo: tipo_plazo ?? (plazo != null ? "meses" : null),
          };

    const payload = {
      cliente_id,
      tipo_cartera_id: tipoId,
      ...payloadPlazo,
      fecha_alta: toYMD(fecha_alta) || toYMD(new Date()),
      rend_esperado: rend_esperado ?? null,
      deposito_inicial: deposito_inicial ?? null,
    };

    const { data, error } = await sb
      .from("fondo")
      .insert(payload)
      .select(SELECT_BASE)
      .single();

    if (error) throw error;
    return NextResponse.json({ data: mapRow(data) }, { status: 201 });
  } catch (e) {
    console.error("POST /api/fondo error:", e);
    return NextResponse.json({ error: "Error al crear el fondo" }, { status: 500 });
  }
}

export async function PATCH(req) {
  const auth = await assertAllowedUser(req);
  if (!auth.ok) return auth.res;
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { id, ...changes } = parsed.data;
    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
    }

    const supabase = getSb();
    const { data, error } = await supabase
      .from("fondo")
      .update(changes)
      .eq("id_fondo", id)
      .select(SELECT_BASE)
      .single();

    if (error) throw error;
    return NextResponse.json({ data: mapRow(data) });
  } catch (e) {
    console.error("PATCH /api/fondo error:", e);
    return NextResponse.json({ error: "Error al actualizar el fondo" }, { status: 500 });
  }
}

export async function DELETE(req) {
  const auth = await assertAllowedUser(req);
  if (!auth.ok) return auth.res;
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Falta id válido" }, { status: 400 });
    }

    const supabase = getSb();
    const { error } = await supabase.from("fondo").delete().eq("id_fondo", parsed.data.id);
    if (error) throw error;

    return new Response(null, { status: 204 });
  } catch (e) {
    console.error("DELETE /api/fondo error:", e);
    return NextResponse.json({ error: "Error al eliminar el fondo" }, { status: 500 });
  }
}