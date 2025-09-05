import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

function parseList(envVal) {
  return String(envVal || '')
    .split(/[,\n;]/)
    .map((s) => s.trim().replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

export async function assertAllowedUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'Supabase no configurado' }, { status: 500 }),
    };
  }

  const cookieStore = cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {}
      },
      remove(name, options) {
        try {
          cookieStore.set({ name, value: '', ...options, maxAge: 0 });
        } catch {}
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { ok: false, res: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  }

  const user = data.user;
  const allowedIds = new Set(parseList(process.env.SUPABASE_ALLOWED_USER_IDS));
  const allowedEmails = new Set(parseList(process.env.SUPABASE_ALLOWED_EMAILS).map((e) => e.toLowerCase()));

  const uidOk = allowedIds.size ? allowedIds.has(user.id) : false;
  const emailOk = allowedEmails.size ? allowedEmails.has((user.email || '').toLowerCase()) : false;

  if (uidOk || emailOk) return { ok: true, user };

  // Mensaje corto (no revelar datos en prod)
  return { ok: false, res: NextResponse.json({ error: 'Prohibido' }, { status: 403 }) };
}