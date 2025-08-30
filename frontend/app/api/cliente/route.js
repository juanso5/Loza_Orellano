export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const getSb = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only
  if (!url || !key) {
    console.error("[Supabase] Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    throw new Error("Supabase no configurado");
  }
  return createClient(url, key, { auth: { persistSession: false } });
};

const mapRow = (r) => {
  const bankName = r.banco || "";
  const alias = r.alias || "";
  const comments = r.comentario || "";
  return {
    id: Number(r.id_cliente),
    name: r.nombre || "",
    serviceType: r.tipo_servicio || "",
    phone: r.celular == null ? "" : String(r.celular),
    alias,                     // compat UI
    bank: bankName,            // compat UI
    bankAlias: alias,          // compat UI
    fee: typeof r.arancel === "number" ? r.arancel : r.arancel == null ? "" : Number(r.arancel),
    period: r.periodo || "",
    riskProfile: r.perfil || "",
    comments,                  // UI espera "comments"
    // Para la UI que usa lista de bancos:
    banks: bankName ? [{ name: bankName, alias }] : [],
  };
};

const onlyDigits = (s = "") => String(s).replace(/\D/g, "");

// Normalización (celular como texto, arancel 0–100, banco y comentario)
function normalizeBody(body) {
  const nombre = (body.nombre ?? body.name ?? "").toString().trim();
  if (!nombre) return { error: "El nombre es obligatorio." };

  const tipo_servicio = (body.tipo_servicio ?? body.serviceType ?? "").toString().trim() || null;
  const periodo = (body.periodo ?? body.period ?? "").toString().trim() || null;
  const perfil = (body.perfil ?? body.riskProfile ?? "").toString().trim() || null;

  // celular -> solo dígitos como varchar (hasta 20)
  let celular = body.celular ?? body.phone ?? null;
  if (celular !== null && celular !== undefined && celular !== "") {
    const digits = onlyDigits(celular).slice(0, 20);
    celular = digits || null;
  } else celular = null;

  // banco/alias puede venir como campos sueltos o desde banks[0]
  const banksArr = Array.isArray(body.banks) ? body.banks : [];
  const firstBank = banksArr[0] || null;

  let banco = (body.banco ?? body.bank ?? firstBank?.name ?? "").toString().trim();
  banco = banco === "" ? null : banco;

  let alias = (body.alias ?? body.bankAlias ?? firstBank?.alias ?? "").toString().trim();
  alias = alias === "" ? null : alias;

  // arancel 0–100
  let arancel = body.arancel ?? body.fee ?? null;
  if (arancel !== null && arancel !== undefined && arancel !== "") {
    const f = Number(String(arancel).replace(",", "."));
    if (Number.isNaN(f) || f < 0 || f > 100) return { error: "Arancel inválido (0 a 100%)." };
    arancel = f;
  } else arancel = null;

  // comentario
  let comentario = (body.comentario ?? body.comments ?? "").toString().trim();
  comentario = comentario === "" ? null : comentario;

  return { values: { nombre, tipo_servicio, celular, alias, arancel, periodo, perfil, banco, comentario } };
}

export async function GET() {
  try {
    const supabase = getSb();
    const { data, error } = await supabase
      .from("cliente")
      .select("id_cliente, nombre, tipo_servicio, celular, alias, arancel, periodo, perfil, banco, comentario")
      .order("id_cliente", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ data: (data || []).map(mapRow) });
  } catch (e) {
    console.error("GET /api/cliente error:", e);
    return NextResponse.json({ error: "Error al obtener clientes" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { error, values } = normalizeBody(body);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const supabase = getSb();
    const { data, error: err } = await supabase
      .from("cliente")
      .insert([values])
      .select("id_cliente, nombre, tipo_servicio, celular, alias, arancel, periodo, perfil, banco, comentario")
      .single();

    if (err) throw err;
    return NextResponse.json({ data: mapRow(data) }, { status: 201 });
  } catch (e) {
    console.error("POST /api/cliente error:", e);
    return NextResponse.json({ error: "Error al crear el cliente" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const id = body.id ?? body.id_cliente;
    if (!id) return NextResponse.json({ error: "Falta id de cliente" }, { status: 400 });

    // Normalización suave (solo rangos/formato)
    const tmp = normalizeBody({ ...body, nombre: body.nombre ?? body.name ?? "tmp" });
    if (tmp.error && tmp.error !== "El nombre es obligatorio.") {
      return NextResponse.json({ error: tmp.error }, { status: 400 });
    }

    // Construir patch solo con campos presentes
    const mk = (v) => (v === undefined ? undefined : (String(v).trim() === "" ? null : String(v).trim()));
    const patch = {};
    const add = (k, v) => { if (v !== undefined) patch[k] = v; };

    add("nombre", body.nombre ?? body.name);
    add("tipo_servicio", mk(body.tipo_servicio ?? body.serviceType));
    // celular como dígitos
    if (body.celular !== undefined || body.phone !== undefined) {
      const v = body.celular ?? body.phone;
      const digits = (v === "" || v === null || v === undefined) ? null : (onlyDigits(v).slice(0, 20) || null);
      patch.celular = digits;
    }
    add("alias", mk(body.alias ?? body.bankAlias));
    // arancel
    if (body.arancel !== undefined || body.fee !== undefined) {
      const v = body.arancel ?? body.fee;
      if (v === "" || v === null || v === undefined) patch.arancel = null;
      else {
        const f = Number(String(v).replace(",", "."));
        if (Number.isNaN(f) || f < 0 || f > 100) return NextResponse.json({ error: "Arancel inválido (0 a 100%)." }, { status: 400 });
        patch.arancel = f;
      }
    }
    add("periodo", mk(body.periodo ?? body.period));
    add("perfil", mk(body.perfil ?? body.riskProfile));

    // banco y comentario: tomar del body directo o de banks[0]
    if (body.banco !== undefined || body.bank !== undefined || body.banks !== undefined) {
      const first = Array.isArray(body.banks) ? body.banks[0] : undefined;
      const bankName = (body.banco ?? body.bank ?? first?.name ?? "").toString().trim();
      patch.banco = bankName === "" ? null : bankName;
      if (first?.alias !== undefined && (body.alias === undefined && body.bankAlias === undefined)) {
        patch.alias = first.alias?.toString().trim() || null;
      }
    }
    if (body.comentario !== undefined || body.comments !== undefined) {
      const c = (body.comentario ?? body.comments ?? "").toString().trim();
      patch.comentario = c === "" ? null : c;
    }

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Sin cambios" }, { status: 400 });

    const supabase = getSb();
    const { data, error: err } = await supabase
      .from("cliente")
      .update(patch)
      .eq("id_cliente", Number(id))
      .select("id_cliente, nombre, tipo_servicio, celular, alias, arancel, periodo, perfil, banco, comentario")
      .single();

    if (err) throw err;
    return NextResponse.json({ data: mapRow(data) });
  } catch (e) {
    console.error("PATCH /api/cliente error:", e);
    return NextResponse.json({ error: "Error al editar el cliente" }, { status: 400 });
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const id = body.id ?? body.id_cliente;
    if (!id) return NextResponse.json({ error: "Falta id de cliente" }, { status: 400 });

    const supabase = getSb();
    const { error } = await supabase.from("cliente").delete().eq("id_cliente", Number(id));
    if (error) {
      if (error.code === "PGRST116") return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
      throw error;
    }
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error("DELETE /api/cliente error:", e);
    return NextResponse.json({ error: "Error al eliminar el cliente" }, { status: 500 });
  }
}