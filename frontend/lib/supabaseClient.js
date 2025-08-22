// lib/supabaseClient.js
'use client';

import { createBrowserClient } from '@supabase/ssr';

let client;
export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) {
  // Use default cookie naming (sb-<project-ref>-auth-token) for compatibility with SSR/middleware
  client = createBrowserClient(url, key);
  }
  return client;
}
