// middleware.js
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req) {
  const { nextUrl, cookies: reqCookies } = req;
  const url = nextUrl.clone();

  const res = NextResponse.next({ request: { headers: req.headers } });

  // Fast path: check for Supabase auth cookie
  const cookiesList = typeof reqCookies.getAll === 'function' ? reqCookies.getAll() : [];
  const hasSbAuth = cookiesList.some((cookie) => /^sb-.*-auth-token$/.test(cookie.name));
  if (!hasSbAuth) {
    url.pathname = '/login';
    url.searchParams.set('redirectedFrom', nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const supaUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supaUrl || !supaKey) {
    url.pathname = '/login';
    url.searchParams.set('redirectedFrom', nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(supaUrl, supaKey, {
    cookies: {
      get(name) { return reqCookies.get(name)?.value; },
      set(name, value, options) { res.cookies.set({ name, value, ...options }); },
      remove(name, options) { res.cookies.set({ name, value: '', ...options }); },
    },
  });

  try {
    const { data: { user } } = await supabase.auth.getUser();

    // Allowlist desde env (evita hardcode). Ej: ALLOWED_USER_IDS="uuid1,uuid2"
    const allowed = (process.env.ALLOWED_USER_IDS || process.env.NEXT_PUBLIC_ALLOWED_USER_IDS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (!user || (allowed.length > 0 && !allowed.includes(user.id))) {
      url.pathname = '/login';
      url.searchParams.set('redirectedFrom', nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  } catch (err) {
    console.error('Middleware auth error:', err);
    url.pathname = '/login';
    url.searchParams.set('redirectedFrom', nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    '/',
    '/home/:path*',
    '/fondos/:path*',
    '/cliente/:path*',
    '/movimientos/:path*',
    '/dashboard/:path*',
  ],
};