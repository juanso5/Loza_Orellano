import { NextResponse } from "next/server";
import { z } from "zod";
import { assertAuthenticated } from "../../../lib/authGuard";
import { getSSRClient } from "../../../lib/supabaseServer";
import { validarSaldoParaCompra } from "../../../lib/fondoHelpers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const getSb = () => getSSRClient(); // async
// SELECT con joins para nombres
const SELECT_BASE =
  "id_movimiento,cliente_id,fondo_id,fecha_alta,precio_compra,moneda_compra,tipo_cambio_compra,precio_compra_usd,tipo_mov,nominal,tipo_especie_id," +
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
  return Number.isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)).toISOString();
};
const toIsoEndOfDay = (v) => {
  if (!v) return null;
  const s = String(v);
  let d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) d = new Date(`${s}T00:00:00.000Z`);
  else {
    d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
  }
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
};
const toYmd = (v) => {
  if (!v) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
const mapRow = (r) => ({
  id_movimiento: Number(r.id_movimiento),
  cliente_id: Number(r.cliente_id),
  fondo_id: Number(r.fondo_id),
  fecha_alta: typeof r.fecha_alta === "string" ? r.fecha_alta : new Date(r.fecha_alta).toISOString(),
  // Nuevos campos de moneda
  precio_compra: r.precio_compra == null ? null : Number(r.precio_compra),
  moneda_compra: r.moneda_compra || 'USD',
  tipo_cambio_compra: r.tipo_cambio_compra == null ? null : Number(r.tipo_cambio_compra),
  precio_compra_usd: r.precio_compra_usd == null ? null : Number(r.precio_compra_usd),
  // Backward compatibility
  precio_usd: r.precio_compra_usd == null ? (r.precio_compra == null ? null : Number(r.precio_compra)) : Number(r.precio_compra_usd),
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
  // Precio de transacción (lo que pagaste/vendiste)
  precio_compra: z.coerce.number().optional().nullable(),
  moneda_compra: z.enum(["USD", "ARS", "USDC"]).optional().default("USD"),
  tipo_cambio_compra: z.coerce.number().positive().optional().nullable(),
  tipo_especie_id: z.coerce.number().int().positive().optional(),
  especie: z.string().min(1).optional(),
  // Backward compatibility (si viene precio_usd, lo mapeamos a precio_compra)
  precio_usd: z.coerce.number().optional().nullable(),
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
const upsertPreciosSchema = z.object({
  action: z.literal("upsertPrecios"),
  fecha: z.union([ymd, z.string().datetime()]),
  fuente: z.string().optional(),
  items: z.array(
    z.object({
      instrumento: z.string().min(1),
      moneda: z.string().optional(),
      precio: z.coerce.number().positive(),
    })
  ).min(1),
});
// GET
export async function GET(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  try {
    const sb = await getSb();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    if (action === "latestPrecios") {
      const { data, error } = await sb
        .from("precio_especie")
        .select("tipo_especie_id,precio,precio_usd,moneda,tipo_cambio_usado,fecha,tipo_especie:tipo_especie_id(id_tipo_especie,nombre)")
        .order("tipo_especie_id", { ascending: true })
        .order("fecha", { ascending: false })
        .limit(20000);
      if (error) throw error;
      const latestById = new Map();
      for (const r of data || []) {
        const id = Number(r.tipo_especie_id);
        if (!latestById.has(id)) {
          // Usar precio_usd (normalizado) si existe, sino precio original
          const precioUSD = r.precio_usd != null ? Number(r.precio_usd) : Number(r.precio);
          latestById.set(id, {
            tipo_especie_id: id,
            nombre: r?.tipo_especie?.nombre ?? null,
            precio: Number(r.precio), // Precio original (puede ser ARS)
            precio_usd: precioUSD, // Precio normalizado en USD
            moneda: r.moneda || 'USD',
            tipo_cambio_usado: r.tipo_cambio_usado,
            fecha: r.fecha,
          });
        }
      }
      return NextResponse.json({ data: Array.from(latestById.values()) });
    }
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
    const status = e?.status || 500;
    return NextResponse.json({ error: "Error al obtener movimientos" }, { status });
  }
}
// POST
export async function POST(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  try {
    const sb = await getSb();
    const body = await req.json().catch(() => ({}));
    // Verificar si es acci├│n de upsertPrecios
    if (body.action === "upsertPrecios") {
      const parsed = upsertPreciosSchema.safeParse(body);
      if (!parsed.success) {
        const details = parsed.error.issues?.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
        return NextResponse.json({ error: `Datos inv├ílidos: ${details || "Error de validaci├│n"}` }, { status: 400 });
      }
      const { fecha, items } = parsed.data;
      const targetDate = toYmd(fecha);
      if (!targetDate) {
        return NextResponse.json({ error: "fecha inv├ílida" }, { status: 400 });
      }
      let exitosos = 0;
      let fallidos = 0;
      const errores = [];
      for (const item of items) {
        const nombre = (item.instrumento || "").toString().trim();
        if (!nombre) {
          fallidos++;
          continue;
        }
        try {
          // Buscar o crear el tipo_especie
          let tipoEspecieId = null;
          const { data: existingEspecie, error: selectError } = await sb
            .from("tipo_especie")
            .select("id_tipo_especie")
            .eq("nombre", nombre)
            .maybeSingle();
          if (selectError) {
            errores.push(`${nombre}: ${selectError.message}`);
            fallidos++;
            continue;
          }
          if (existingEspecie) {
            tipoEspecieId = existingEspecie.id_tipo_especie;
          } else {
            // Crear nueva especie si no existe
            const { data: newEspecie, error: createError } = await sb
              .from("tipo_especie")
              .insert({ nombre })
              .select("id_tipo_especie")
              .single();
            if (createError) {
              errores.push(`${nombre}: ${createError.message}`);
              fallidos++;
              continue;
            }
            tipoEspecieId = newEspecie.id_tipo_especie;
          }
          // Ahora insertar el precio con tipo_especie_id
          const { error: upsertError } = await sb.from("precio_especie").upsert(
            { 
              tipo_especie_id: tipoEspecieId,
              fecha: targetDate, 
              precio: parseFloat(item.precio)
            },
            { onConflict: "tipo_especie_id,fecha", ignoreDuplicates: false }
          );
          if (upsertError) {
            errores.push(`${nombre}: ${upsertError.message}`);
            fallidos++;
          } else {
            exitosos++;
          }
        } catch (err) {
          errores.push(`${nombre}: ${err.message}`);
          fallidos++;
        }
      }
      const mensaje = `Procesados: ${exitosos} exitosos, ${fallidos} fallidos de ${items.length} total`;
      if (errores.length > 0) {
        }
      return NextResponse.json({ 
        success: true, 
        message: mensaje,
        exitosos,
        fallidos,
        errores: errores.slice(0, 10) // Solo los primeros 10 errores
      });
    }
    // Validar movimiento normal
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.issues?.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
      return NextResponse.json({ error: `Datos inv├ílidos: ${details}` }, { status: 400 });
    }
    const {
      cliente_id,
      fondo_id,
      tipo_especie_id,
      fecha_alta,
      precio_compra,
      precio_usd,  // Backward compatibility
      moneda_compra,
      tipo_cambio_compra,
      tipo_mov,
      nominal,
      especie,
    } = parsed.data;
    // Determinar precio final (prioridad: precio_compra > precio_usd)
    const precioFinal = precio_compra || precio_usd;
    const monedaFinal = moneda_compra || 'USD';
    const tcFinal = tipo_cambio_compra;
    // Calcular precio en USD
    let precio_compra_usd;
    if (monedaFinal === 'USD' || monedaFinal === 'USDC') {
      precio_compra_usd = precioFinal;
    } else if (monedaFinal === 'ARS' && tcFinal) {
      precio_compra_usd = precioFinal / tcFinal;
    } else if (monedaFinal === 'ARS') {
      return NextResponse.json({
        error: "Si la moneda es ARS, debe proporcionar tipo_cambio_compra"
      }, { status: 400 });
    } else {
      precio_compra_usd = precioFinal;
    }
    // 🔥 VALIDAR LIQUIDEZ DEL FONDO PARA COMPRAS
    if (tipo_mov === "compra") {
      // Validar que precio sea válido
      const precioNum = parseFloat(precio_compra_usd);
      if (!precioFinal || isNaN(precioNum) || precioNum <= 0) {
        return NextResponse.json({
          error: "Para una compra se requiere un precio válido y mayor a 0"
        }, { status: 400 });
      }
      const nominalNum = parseInt(nominal);
      if (isNaN(nominalNum) || nominalNum <= 0) {
        return NextResponse.json({
          error: "El nominal debe ser un número válido y mayor a 0"
        }, { status: 400 });
      }
      const costoCompra = precio_compra_usd * nominalNum;
      // Importar helper
      const { validarSaldoParaCompra } = await import("../../../lib/fondoHelpers");
      const validacion = await validarSaldoParaCompra(sb, cliente_id, fondo_id, costoCompra);
      if (!validacion.valido) {
        return NextResponse.json({
          error: `El fondo no tiene liquidez suficiente. Disponible: $${validacion.disponible.toFixed(2)} USD. Necesario: $${costoCompra.toFixed(2)} USD`,
          disponible: validacion.disponible,
          faltante: validacion.faltante
        }, { status: 400 });
      }
    }
    // Validar que el cliente_id coincida con el del fondo
    const { data: fondoData, error: fondoErr } = await sb
      .from("fondo")
      .select("cliente_id")
      .eq("id_fondo", fondo_id)
      .single();
    if (fondoErr || !fondoData) {
      return NextResponse.json({ error: "Fondo no encontrado" }, { status: 404 });
    }
    if (Number(fondoData.cliente_id) !== Number(cliente_id)) {
      return NextResponse.json(
        { error: "El fondo no pertenece al cliente especificado" },
        { status: 403 }
      );
    }
    // Si se proporciona especie (nombre) en lugar de tipo_especie_id, buscar/crear
    let finalTipoEspecieId = tipo_especie_id;
    if (!finalTipoEspecieId && especie) {
      const especieTrim = especie.trim();
      const { data: existing } = await sb
        .from("tipo_especie")
        .select("id_tipo_especie")
        .eq("nombre", especieTrim)
        .single();
      if (existing) {
        finalTipoEspecieId = existing.id_tipo_especie;
      } else {
        const { data: created, error: createErr } = await sb
          .from("tipo_especie")
          .insert({ nombre: especieTrim })
          .select("id_tipo_especie")
          .single();
        if (createErr) {
          return NextResponse.json({ error: `Error creando especie: ${createErr.message}` }, { status: 500 });
        }
        finalTipoEspecieId = created.id_tipo_especie;
      }
    }
    if (!finalTipoEspecieId) {
      return NextResponse.json({ error: "Se requiere tipo_especie_id o especie" }, { status: 400 });
    }
    const payload = {
      cliente_id,
      fondo_id,
      tipo_especie_id: finalTipoEspecieId,
      fecha_alta: fecha_alta || new Date().toISOString(),
      precio_compra: precioFinal != null ? parseFloat(precioFinal) : null,
      moneda_compra: monedaFinal,
      tipo_cambio_compra: tcFinal != null ? parseFloat(tcFinal) : null,
      precio_compra_usd: precio_compra_usd != null ? parseFloat(precio_compra_usd) : null,
      tipo_mov,
      nominal: parseInt(nominal),
    };
    const { data, error } = await sb
      .from("movimiento")
      .insert(payload)
      .select(SELECT_BASE)
      .single();
    if (error) throw error;
    // ✅ Solo retornar el movimiento creado
    // La liquidez del fondo se calcula automáticamente mediante:
    // - calcular_liquidez_fondo(): asignaciones_manuales - compras + ventas
    // - v_estado_fondo: vista actualizada que usa la función
    return NextResponse.json({ data: mapRow(data) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Error al crear movimiento" }, { status: 500 });
  }
}
// PATCH
export async function PATCH(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  try {
    const sb = await getSb();
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
    const patch = {};
    if (cliente_id != null) patch.cliente_id = cliente_id;
    if (fondo_id != null) patch.fondo_id = fondo_id;
    if (fecha_alta != null) patch.fecha_alta = toIsoStartOfDay(fecha_alta) ?? undefined;
    if (tipo_mov != null) patch.tipo_mov = tipo_mov;
    if (nominal != null) patch.nominal = nominal;
    if (precio_usd !== undefined) patch.precio_usd = precio_usd ?? null;
    if (tipo_especie_id != null || especie != null) {
      const nameToId = async () => {
        if (tipo_especie_id) return Number(tipo_especie_id);
        const name = (especie || '').trim();
        if (!name) return undefined;
        const q = await sb.from('tipo_especie').select('id_tipo_especie').eq('nombre', name).limit(1);
        if (q.error) throw q.error;
        return q.data?.[0]?.id_tipo_especie;
      };
      const resolved = await nameToId();
      if (resolved != null) patch.tipo_especie_id = resolved;
    }
    if (patch.fondo_id != null || patch.cliente_id != null) {
      const cId = patch.cliente_id ?? cliente_id;
      const fId = patch.fondo_id ?? fondo_id;
      if (cId && fId) {
        const { data, error } = await sb
          .from("fondo")
          .select("id_fondo,cliente_id")
          .eq("id_fondo", fId)
          .single();
        if (error) throw error;
        if (!data || Number(data.cliente_id) !== Number(cId)) {
          return NextResponse.json({ error: "El fondo no pertenece al cliente indicado" }, { status: 400 });
        }
      }
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
    const status = e?.status || 500;
    return NextResponse.json({ error: e?.message || "Error al actualizar movimiento" }, { status });
  }
}
// DELETE
export async function DELETE(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  try {
    const sb = await getSb();
    const body = await req.json().catch(() => ({}));
    const parsed = z.object({ id: z.coerce.number().int().positive() }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Falta id v├ílido" }, { status: 400 });
    }
    const { error } = await sb.from("movimiento").delete().eq("id_movimiento", parsed.data.id);
    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: "Error al eliminar movimiento" }, { status: 500 });
  }
}
