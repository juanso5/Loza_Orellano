// app/api/liquidez/patrimonio/route.js - NUEVO ARCHIVO
import { NextResponse } from "next/server";
import { assertAuthenticated } from "../../../../lib/authGuard";
import { getSSRClient } from "../../../../lib/supabaseServer";
import { calcularPatrimonioTotal } from "../../../../lib/liquidezHelpers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  try {
    const sb = await getSSRClient();
    const { searchParams } = new URL(req.url);
    const clienteId = searchParams.get("cliente_id");
    if (!clienteId) {
      return NextResponse.json(
        { success: false, error: "cliente_id es requerido" },
        { status: 400 }
      );
    }
    const patrimonio = await calcularPatrimonioTotal(sb, parseInt(clienteId));
    return NextResponse.json({
      success: true,
      data: patrimonio
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}
