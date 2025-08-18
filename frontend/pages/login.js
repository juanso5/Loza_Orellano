import { useState } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message || 'Error al iniciar sesión');
      } else {
        setMessage('Sesión iniciada');
        router.push('/home');
      }
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
    }
  };

  const sendMagicLink = async () => {
    setLoading(true);
    setMessage('');
    try {
      const { data, error } = await supabase.auth.signInWithOtp({ email });
      if (error) setMessage(error.message || 'Error enviando link');
      else setMessage('Link enviado a tu correo (revisá spam).');
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Login - Loza Orellano</title></Head>
      <div style={{ padding: 24 }}>
        <h2>Iniciar sesión</h2>
        <form onSubmit={submit} style={{ maxWidth: 420 }}>
          <div style={{ marginBottom: 8 }}>
            <label>Email</label><br />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Contraseña</label><br />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="submit" disabled={loading}>{loading ? 'Cargando...' : 'Entrar'}</button>
            <button type="button" onClick={sendMagicLink} style={{ marginLeft: 8 }} disabled={loading}>Enviar link mágico</button>
          </div>
        </form>
        {message && <div style={{ marginTop: 12 }}>{message}</div>}
      </div>
    </>
  );
}
