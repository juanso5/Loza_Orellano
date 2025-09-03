'use client';
// ...existing code...
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '../../lib/supabaseClient';


export default function LoginClient({ redirectedFrom = '/home' }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  // Si ya hay sesión, ir directo al destino; el middleware decidirá si pide MFA
  useEffect(() => {
    const check = async () => {
      const sb = getSupabaseBrowserClient();
      if (!sb) return;
      const { data: { session } } = await sb.auth.getSession();
      if (session) router.replace(redirectedFrom);
    };
    check();
  }, [router, redirectedFrom]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const sb = getSupabaseBrowserClient();
    if (!sb) return;

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      setErr(error.message || 'No se pudo iniciar sesión');
      setLoading(false);
      return;
    }
    // Dejar que el middleware haga el enforcement de AAL2
    router.replace(redirectedFrom);
    setLoading(false);
  };

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 420, margin: '40px auto', padding: 16 }}>
      <h1>Ingresar</h1>
      <input
        type="email" placeholder="Email" value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 8 }} required
      />
      <input
        type="password" placeholder="Contraseña" value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 8 }} required
      />
      {err && <p style={{ color: 'crimson' }}>{err}</p>}
      <button disabled={loading} type="submit" style={{ width: '100%', padding: 10 }}>
        {loading ? 'Ingresando...' : 'Ingresar'}
      </button>
    </form>
  );
}