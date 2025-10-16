import { NextResponse } from "next/server";
import { z } from "zod";
import { assertAuthenticated } from "../../../lib/authGuard";
import { getSSRClient } from "../../../lib/supabaseServer";
import { calcularEstadoLiquidez } from "../../../lib/liquidezHelpers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const getSb = () => getSSRClient(); // async
const SELECT_BASE =
  "id_fondo,cliente_id,nombre,tipo_cartera:tipo_cartera_id(id_tipo_cartera,descripcion,categoria,color,icono),plazo,tipo_plazo,fecha_alta,rend_esperado,deposito_inicial,metadata";
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
    nombre: r.nombre || null,
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
    metadata: r.metadata || null,
  };
  if (r.tipo_cartera) out.tipo_cartera = r.tipo_cartera;
  return out;
}
// Validaciones
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable();
// Metadata schemas por estrategia
const metadataJubilacionSchema = z.object({
  estrategia: z.literal('jubilacion'),
  anos: z.coerce.number().int().min(1).max(50),
  comentario: z.string().optional().nullable(),
});
const metadataLargoPlazoSchema = z.object({
  estrategia: z.literal('largo_plazo'),
  comentario: z.string().optional().nullable(),
});
const metadataViajesSchema = z.object({
  estrategia: z.literal('viajes'),
  monto_objetivo_usd: z.coerce.number().positive(),
  tipo_cambio: z.coerce.number().positive().optional().nullable(),
  monto_objetivo_ars: z.coerce.number().positive().optional().nullable(),
  comentario: z.string().optional().nullable(),
});
const metadataObjetivoSchema = z.object({
  estrategia: z.literal('objetivo'),
  fecha_objetivo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monto_objetivo_usd: z.coerce.number().positive(),
  tipo_cambio: z.coerce.number().positive().optional().nullable(),
  monto_objetivo_ars: z.coerce.number().positive().optional().nullable(),
  comentario: z.string().optional().nullable(),
});
const metadataSchema = z.union([
  metadataJubilacionSchema,
  metadataLargoPlazoSchema,
  metadataViajesSchema,
  metadataObjetivoSchema,
]).optional().nullable();
const createSchema = z.object({
  cliente_id: z.coerce.number().int().positive(),
  tipo_cartera_id: z.coerce.number().int().positive(),
  nombre: z.string().min(1, "El nombre es requerido").max(255, "El nombre es muy largo"),
  deposito_inicial: z.coerce.number().nonnegative().default(0),
  plazo: z.coerce.number().int().positive().optional().nullable(),
  tipo_plazo: z.string().optional().nullable(),
  rend_esperado: z.coerce.number().optional().nullable(),
  liquidez_inicial: z.coerce.number().nonnegative().optional().default(0),
  metadata: metadataSchema,
});
const updateSchema = z.object({
  id: z.coerce.number().int().positive(),
  cliente_id: z.coerce.number().int().positive().optional(),
  tipo_cartera_id: z.coerce.number().int().positive().optional(),
  nombre: z.string().min(1).max(255).optional(),
  plazo: z.coerce.number().int().min(0).optional().nullable(),
  tipo_plazo: z.enum(["dias", "meses"]).optional().nullable(),
  fecha_alta: ymd,
  rend_esperado: z.coerce.number().optional().nullable(),
  deposito_inicial: z.coerce.number().optional().nullable(),
  metadata: metadataSchema,
});
const deleteSchema = z.object({ id: z.coerce.number().int().positive() });
export async function GET(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  try {
    const supabase = await getSb();
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
    return NextResponse.json({ error: "Error al obtener fondos" }, { status: 500 });
  }
}
export async function POST(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  try {
    const sb = await getSb();
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.issues?.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
      return NextResponse.json(
        { success: false, error: `Datos inválidos: ${details}` },
        { status: 400 }
      );
    }
    const {
      cliente_id,
      tipo_cartera_id,
      nombre,
      deposito_inicial,
      plazo,
      tipo_plazo,
      rend_esperado,
      liquidez_inicial,
      metadata
    } = parsed.data;
    // Si hay liquidez_inicial, validar primero
    if (liquidez_inicial > 0) {
      // ✅ Calcular directamente en lugar de hacer fetch interno
      const estado = await calcularEstadoLiquidez(sb, cliente_id);
      if (estado.liquidezDisponible < liquidez_inicial) {
        return NextResponse.json({
          success: false,
          error: `Liquidez insuficiente. Disponible: $${estado.liquidezDisponible.toFixed(2)} USD`,
          detalles: {
            requerido: liquidez_inicial,
            disponible: estado.liquidezDisponible,
            total: estado.liquidezTotal
          }
        }, { status: 400 });
      }
      }
    // 1. Crear el fondo
    const payload = {
      cliente_id,
      tipo_cartera_id,
      nombre: nombre.trim(),
      deposito_inicial: parseFloat(deposito_inicial),
      plazo,
      tipo_plazo,
      rend_esperado: rend_esperado ? parseFloat(rend_esperado) : null,
      fecha_alta: new Date().toISOString(),
      metadata: metadata || null,
    };
    const { data: fondoData, error: fondoError } = await sb
      .from("fondo")
      .insert(payload)
      .select(SELECT_BASE)
      .single();
    if (fondoError) throw fondoError;
    // 2. Si hay liquidez_inicial, asignarla automáticamente
    if (liquidez_inicial > 0) {
      try {
        // ✅ Insertar directamente en la tabla en lugar de fetch
        const { data: asignacionData, error: asignacionError } = await sb
          .from("asignacion_liquidez")
          .insert({
            cliente_id: Number(cliente_id),
            fondo_id: Number(fondoData.id_fondo),
            fecha: new Date().toISOString(),
            tipo_operacion: 'asignacion',
            monto: parseFloat(liquidez_inicial),
            moneda: 'USD',
            tipo_cambio_usado: null,
            monto_usd: parseFloat(liquidez_inicial),
            comentario: 'Asignación inicial al crear fondo',
            origen: 'manual',
          })
          .select()
          .single();
        if (asignacionError) {
          // No lanzar error, solo loguear - el fondo ya fue creado
        } else {
          }
      } catch (e) {
        // Tolerar el error para no romper la creación del fondo
      }
    }
    return NextResponse.json(
      {
        success: true,
        data: mapRow(fondoData),
        message: liquidez_inicial > 0
          ? `Fondo creado y liquidez inicial de $${liquidez_inicial} asignada`
          : "Fondo creado exitosamente",
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e?.message || "Error al crear fondo" },
      { status: 500 }
    );
  }
}
export async function PATCH(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  try {
    const supabase = await getSb();
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { id, ...changes } = parsed.data;
    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("fondo")
      .update(changes)
      .eq("id_fondo", id)
      .select(SELECT_BASE)
      .single();
    if (error) throw error;
    return NextResponse.json({ data: mapRow(data) });
  } catch (e) {
    return NextResponse.json({ error: "Error al actualizar el fondo" }, { status: 500 });
  }
}
export async function DELETE(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  try {
    const supabase = await getSb();
    const body = await req.json().catch(() => ({}));
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Falta id válido" }, { status: 400 });
    }
    const fondoId = parsed.data.id;
    // Verificar si hay movimientos asociados
    const { data: movimientos, error: movError } = await supabase
      .from("movimiento")
      .select("id_movimiento")
      .eq("fondo_id", fondoId)
      .limit(1);
    if (movError) {
      }
    if (movimientos && movimientos.length > 0) {
      return NextResponse.json(
        { 
          error: "No se puede eliminar esta cartera porque tiene movimientos asociados. Primero eliminá los movimientos.",
          detalles: "Esta cartera está en uso"
        },
        { status: 409 } // 409 Conflict
      );
    }
    // Verificar si hay asignaciones de liquidez
    const { data: liquidez, error: liqError } = await supabase
      .from("asignacion_liquidez")
      .select("id_asignacion")
      .eq("fondo_id", fondoId)
      .limit(1);
    if (liqError) {
      }
    if (liquidez && liquidez.length > 0) {
      return NextResponse.json(
        { 
          error: "No se puede eliminar esta cartera porque tiene asignaciones de liquidez. Primero eliminá las asignaciones.",
          detalles: "Esta cartera tiene liquidez asignada"
        },
        { status: 409 }
      );
    }
    // Si no hay dependencias, eliminar
    const { error } = await supabase.from("fondo").delete().eq("id_fondo", fondoId);
    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (e) {
    // Mejorar mensaje según el tipo de error
    let errorMsg = "Error al eliminar el fondo";
    if (e.code === '23503') { // Foreign key violation
      errorMsg = "No se puede eliminar esta cartera porque tiene datos relacionados (movimientos o liquidez asignada)";
    } else if (e.message) {
      errorMsg = e.message;
    }
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}