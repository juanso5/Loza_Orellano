import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertAuthenticated } from '../../../lib/authGuard';
import { getSSRClient } from '../../../lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const dateYMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
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
const deleteSchema = z.object({ id: z.coerce.number().int().positive() });

function normalize(row) {
  return {
    id: row.id_tarea,
    title: row.titulo,
    description: row.descripcion ?? '',
    date: typeof row.fecha === 'string' ? row.fecha : new Date(row.fecha).toISOString().slice(0,10),
    priority: row.prioridad,
    completed: row.estado_tarea === 'completada',
  };
}

export async function GET() {
  const auth = await assertAuthenticated();
  if (!auth.ok) return auth.res;
  const sb = await getSSRClient();
  const { data, error } = await sb.from('tarea').select('*').order('fecha', { ascending: true }).order('id_tarea', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: (data || []).map(normalize) });
}

export async function POST(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const sb = await getSSRClient();
  const payload = { titulo: parsed.data.title, descripcion: parsed.data.description, fecha: parsed.data.date, prioridad: parsed.data.priority, estado_tarea: 'pendiente' };
  const { data, error } = await sb.from('tarea').insert(payload).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: normalize(data) }, { status: 201 });
}

export async function PATCH(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { id, ...changes } = parsed.data;
  const updates = {
    ...(changes.title !== undefined ? { titulo: changes.title } : {}),
    ...(changes.description !== undefined ? { descripcion: changes.description } : {}),
    ...(changes.date !== undefined ? { fecha: changes.date } : {}),
    ...(changes.priority !== undefined ? { prioridad: changes.priority } : {}),
    ...(changes.completed !== undefined ? { estado_tarea: changes.completed ? 'completada' : 'pendiente' } : {}),
  };
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });

  const sb = await getSSRClient();
  const { data, error } = await sb.from('tarea').update(updates).eq('id_tarea', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: normalize(data) });
}

export async function DELETE(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({}));
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Falta id válido' }, { status: 400 });

  const sb = await getSSRClient();
  const { error } = await sb.from('tarea').delete().eq('id_tarea', parsed.data.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new Response(null, { status: 204 });
}