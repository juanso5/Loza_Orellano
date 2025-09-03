import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req) {
  const { pathname, search } = req.nextUrl;

  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/verify-email') ||     // <-- agregado
    pathname.startsWith('/mfa/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/assets');

  if (isPublic) return NextResponse.next();

  const PROTECTED_PREFIXES = [
    '/home',
    '/dashboard',
    '/cliente',
    '/clientes',
    '/fondo',
    '/fondos',
    '/movimiento',
    '/movimientos',
  ];
  const requiresAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );
  if (!requiresAuth) return NextResponse.next();

  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => res.cookies.set({ name, value, ...options }),
        remove: (name, options) => res.cookies.set({ name, value: '', ...options, maxAge: 0 }),
      },
    }
  );

  await supabase.auth.getSession();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const dst = new URL(`/login?returnUrl=${encodeURIComponent(pathname + (search || ''))}`, req.url);
    return NextResponse.redirect(dst, { headers: res.headers });
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') {
    const dst = new URL(`/mfa/verify?returnUrl=${encodeURIComponent(pathname + (search || ''))}`, req.url);
    return NextResponse.redirect(dst, { headers: res.headers });
  }

  return res;
}

export const config = {
  matcher: [
    '/home/:path*',
    '/dashboard/:path*',
    '/cliente/:path*',
    '/clientes/:path*',
    '/fondo/:path*',
    '/fondos/:path*',
    '/movimiento/:path*',
    '/movimientos/:path*',
  ],
};