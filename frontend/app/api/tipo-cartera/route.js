import { NextResponse } from "next/server";
import { assertAuthenticated } from "../../../lib/authGuard";
import { getSSRClient } from "../../../lib/supabaseServer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const getSb = () => getSSRClient();
// GET - Obtener tipos de cartera
export async function GET(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  try {
    const sb = await getSb();
    const { searchParams } = new URL(req.url);
    const soloActivos = searchParams.get("activos") !== "false";
    let query = sb
      .from("tipo_cartera")
      .select("*")
      .order("orden", { ascending: true })
      .order("descripcion", { ascending: true });
    if (soloActivos) {
      query = query.eq("activo", true);
    }
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({
      success: true,
      data: (data || []).map((t) => ({
        id: t.id_tipo_cartera,
        descripcion: t.descripcion,
        categoria: t.categoria,
        mostrar_liquidez_usd: t.mostrar_liquidez_usd,
        color: t.color,
        icono: t.icono,
        descripcion_larga: t.descripcion_larga,
        orden: t.orden,
        activo: t.activo,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}
// POST - Crear nuevo tipo de cartera personalizado
export async function POST(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  try {
    const sb = await getSb();
    const body = await req.json();
    const { descripcion, categoria, color, icono, descripcion_larga } = body;
    if (!descripcion || descripcion.trim() === "") {
      return NextResponse.json(
        { success: false, error: "La descripción es obligatoria" },
        { status: 400 }
      );
    }
    const insertData = {
      descripcion: descripcion.trim(),
      categoria: categoria || "personalizada",
      mostrar_liquidez_usd: body.mostrar_liquidez_usd !== false,
      color: color || "#8b5cf6",
      icono: icono || "⚙️",
      descripcion_larga: descripcion_larga || null,
      activo: true,
      orden: 900, // Las personalizadas van al final
    };
    const { data, error } = await sb
      .from("tipo_cartera")
      .insert(insertData)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({
      success: true,
      data: {
        id: data.id_tipo_cartera,
        descripcion: data.descripcion,
        categoria: data.categoria,
        mostrar_liquidez_usd: data.mostrar_liquidez_usd,
        color: data.color,
        icono: data.icono,
        descripcion_larga: data.descripcion_larga,
        orden: data.orden,
        activo: data.activo,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}
