'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

function VerifyEmailInner() {
  const router = useRouter();
  const search = useSearchParams();
  const returnUrl = search?.get('returnUrl') || '/home';

  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const resend = async () => {
    setErr(''); setMsg(''); setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/login?reason=need-auth');
      return;
    }
    const redirectTo = `${window.location.origin}/login?verified=1`;
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) setErr(error.message);
    else setMsg('Te enviamos un correo para verificar tu email.');
    setLoading(false);
  };

  const check = async () => {
    setErr(''); setMsg('Revisando verificación...');
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.getSession();
    const { data: { user } } = await supabase.auth.getUser();
    const confirmed = user?.email_confirmed_at || user?.confirmed_at;
    if (confirmed) router.replace(`/mfa/setup?returnUrl=${encodeURIComponent(returnUrl)}`);
    else setMsg('Aún no figura verificado. Refrescá después de confirmar el email.');
  };

  const logout = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <div style={{ maxWidth: 520, margin: '40px auto', padding: 16 }}>
      <h1>Verificá tu email</h1>
      <p>Antes de activar el MFA necesitás confirmar tu correo. Revisá tu bandeja de entrada.</p>
      {msg && <p style={{ color: 'green' }}>{msg}</p>}
      {err && <p style={{ color: 'crimson' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={resend} disabled={loading} style={{ padding: 10 }}>Reenviar verificación</button>
        <button onClick={check} style={{ padding: 10 }}>Ya verifiqué</button>
        <button onClick={logout} style={{ padding: 10, background: '#eee' }}>Cambiar usuario</button>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Cargando...</div>}>
      <VerifyEmailInner />
    </Suspense>
  );
}