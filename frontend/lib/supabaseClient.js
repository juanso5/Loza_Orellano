'use client';
// ...existing code...
import { createBrowserClient } from '@supabase/ssr';
let client;
/**
 * Cliente de navegador con sesión en cookies (compartida con middleware/servidor).
 */
export function getSupabaseBrowserClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return null;
  }
  client = createBrowserClient(url, key);
  return client;
}