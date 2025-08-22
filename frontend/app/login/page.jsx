'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '../../lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get('redirectedFrom') || '/home';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // If already logged, redirect
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return; // no env vars yet
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) router.replace(redirectedFrom);
    });
  }, [router, redirectedFrom]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      setError('Faltan variables de entorno de Supabase. Configurá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message || 'No se pudo iniciar sesión');
      return;
    }
    router.replace(redirectedFrom);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', padding: 24, borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.06)' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: 24 }}>Ingresar</h1>
        <p style={{ margin: '0 0 20px 0', color: '#6b7280' }}>Accedé con tu cuenta</p>
        <form onSubmit={onSubmit}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, marginBottom: 12 }}
          />

          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Contraseña</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, marginBottom: 16 }}
          />

          {error && (
            <div style={{ background: '#fef2f2', color: '#991b1b', padding: '10px 12px', borderRadius: 8, marginBottom: 12, fontSize: 14 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !getSupabaseBrowserClient()}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#111827', color: '#fff', border: 'none', fontWeight: 600 }}
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
          {!getSupabaseBrowserClient() && (
            <p style={{ marginTop: 10, color:'#b91c1c', fontSize: 13 }}>
              Variables de entorno no configuradas.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
