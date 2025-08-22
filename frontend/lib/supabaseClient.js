// lib/supabaseClient.js
'use client';

import { createBrowserClient } from '@supabase/ssr';

let client;
export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) {
    client = createBrowserClient(url, key, {
      cookieOptions: { name: 'sb-auth-token' },
    });
  }
  return client;
}
