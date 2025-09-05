import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function assertAuthenticated() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { ok: false, res: NextResponse.json({ error: 'Supabase no configurado' }, { status: 500 }) };
  }

  const cookieStore = await cookies(); // Next 15
  const supabase = createServerClient(url, anon, {
    cookies: {
      get: (name) => cookieStore.get(name)?.value,
      set(name, value, options) { try { cookieStore.set({ name, value, ...options }); } catch {} },
      remove(name, options) { try { cookieStore.set({ name, value: '', ...options, maxAge: 0 }); } catch {} },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { ok: false, res: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  }
  return { ok: true, user: data.user };
}