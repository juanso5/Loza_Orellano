// middleware.js
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req) {
  const { nextUrl, cookies: reqCookies } = req;
  const url = nextUrl.clone();

  const res = NextResponse.next({ request: { headers: req.headers } });

  // Fast path: if there's no Supabase auth cookie, block access immediately
  try {
    const all = typeof reqCookies.getAll === 'function' ? reqCookies.getAll() : [];
    const hasSbAuth = all.some((c) => /^sb-.*-auth-token$/.test(c.name));
    if (!hasSbAuth) {
      url.pathname = '/login';
      url.searchParams.set('redirectedFrom', nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  } catch (_) {
    // ignore and continue with normal flow
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env vars are missing, redirect to login without creating a client
  if (!supaUrl || !supaKey) {
    url.pathname = '/login';
    url.searchParams.set('redirectedFrom', nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(
    supaUrl,
    supaKey,
    {
      cookies: {
        get(name) {
          return reqCookies.get(name)?.value;
        },
        set(name, value, options) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          res.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    url.pathname = '/login';
    url.searchParams.set('redirectedFrom', nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
  // Protect explicit app routes; exclude login and static assets by omission
  '/',
  '/home/:path*',
  '/fondos/:path*',
  '/cliente/:path*',
  '/movimientos/:path*',
  '/dashboard/:path*',
  ],
};
