// middleware.js
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Public routes that don't require auth
const publicRoutes = [
  '/login',
  '/api/auth/callback',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
];

export async function middleware(req) {
  const { nextUrl, cookies: reqCookies } = req;
  const url = nextUrl.clone();

  // Allow public routes
  if (publicRoutes.some((p) => nextUrl.pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const res = NextResponse.next({ request: { headers: req.headers } });

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
    '/((?!_next|.*\..*|api/auth/callback).*)',
  ],
};
