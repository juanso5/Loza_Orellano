import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function getSSRClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Supabase no configurado');

  const cookieStore = await cookies(); // Next 15
  return createServerClient(url, anon, {
    cookies: {
      get: (name) => cookieStore.get(name)?.value,
      set(name, value, options) { try { cookieStore.set({ name, value, ...options }); } catch {} },
      remove(name, options) { try { cookieStore.set({ name, value: '', ...options, maxAge: 0 }); } catch {} },
    },
  });
}