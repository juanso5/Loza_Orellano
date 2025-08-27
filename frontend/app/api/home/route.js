import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const REST_BASE = SUPABASE_URL ? `${SUPABASE_URL}/rest/v1` : '';

async function rest(path, init = {}) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Service role not configured' }), { status: 500 });
  }
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...(init.method === 'POST' || init.method === 'PATCH'
      ? { Prefer: 'return=representation' }
      : {}),
    ...(init.headers || {}),
  };
  return fetch(`${REST_BASE}${path}`, { ...init, headers });
}

// Validación
const dateYMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(''),
  date: dateYMD,
  priority: z.enum(['baja', 'media', 'alta']),
});

const updateSchema = z.object({
  id: z.coerce.number().int().positive(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  date: dateYMD.optional(),
  priority: z.enum(['baja', 'media', 'alta']).optional(),
  completed: z.boolean().optional(),
});

const deleteSchema = z.object({
  id: z.coerce.number().int().positive(),
});

function normalize(row) {
  return {
    id: row.id_tarea,
    title: row.titulo,
    description: row.descripcion ?? '',
    date: typeof row.fecha === 'string'
      ? row.fecha
      : new Date(row.fecha).toISOString().slice(0, 10),
    priority: row.prioridad,
    completed: row.estado_tarea === 'completada',
  };
}

// GET /api/home → listar tareas
export async function GET() {
  const res = await rest('/tarea?select=*&order=fecha.asc,id_tarea.asc', { method: 'GET' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: err.message || err.error || 'Error al listar' }, { status: res.status });
  }
  const rows = await res.json();
  return NextResponse.json({ data: rows.map(normalize) });
}

// POST /api/home → crear tarea
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = {
    titulo: parsed.data.title,
    descripcion: parsed.data.description,
    fecha: parsed.data.date,
    prioridad: parsed.data.priority,
    estado_tarea: 'pendiente',
  };

  const res = await rest('/tarea?select=*', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: err.message || err.error || 'Error al crear' }, { status: res.status });
  }
  const arr = await res.json();
  const row = Array.isArray(arr) ? arr[0] : arr;
  return NextResponse.json({ data: normalize(row) }, { status: 201 });
}

// PATCH /api/home → editar tarea
export async function PATCH(req) {
  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...changes } = parsed.data;
  const updates = {
    ...(changes.title !== undefined ? { titulo: changes.title } : {}),
    ...(changes.description !== undefined ? { descripcion: changes.description } : {}),
    ...(changes.date !== undefined ? { fecha: changes.date } : {}),
    ...(changes.priority !== undefined ? { prioridad: changes.priority } : {}),
    ...(changes.completed !== undefined
      ? { estado_tarea: changes.completed ? 'completada' : 'pendiente' }
      : {}),
  };
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
  }

  const res = await rest(`/tarea?id_tarea=eq.${id}&select=*`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: err.message || err.error || 'Error al editar' }, { status: res.status });
  }
  const arr = await res.json();
  const row = Array.isArray(arr) ? arr[0] : arr;
  return NextResponse.json({ data: normalize(row) });
}

// DELETE /api/home → borrar tarea
export async function DELETE(req) {
  const body = await req.json().catch(() => ({}));
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Falta id válido' }, { status: 400 });
  }

  const res = await rest(`/tarea?id_tarea=eq.${parsed.data.id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: err.message || err.error || 'Error al borrar' }, { status: res.status });
  }
  return new Response(null, { status: 204 });
}