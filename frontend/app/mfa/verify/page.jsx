'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '../../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

export default function MfaVerifyPage() {
  const router = useRouter();
  const search = useSearchParams();
  const returnUrl = search?.get('returnUrl') || '/home';

  const [loading, setLoading] = useState(true);
  const [factorId, setFactorId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login?reason=need-auth');
        return;
      }

      // Gateo por email verificado
      const emailConfirmed = user.email_confirmed_at || user.confirmed_at;
      if (!emailConfirmed) {
        router.replace(`/verify-email?returnUrl=${encodeURIComponent(returnUrl)}`);
        return;
      }

      // Si ya está en AAL2, seguir
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === 'aal2') {
        router.replace(returnUrl);
        return;
      }

      // Buscar TOTP verificado
      const { data: factors, error: lfErr } = await supabase.auth.mfa.listFactors();
      if (lfErr) {
        setErrorMsg(lfErr.message);
        setLoading(false);
        return;
      }
      const totp = factors?.totp?.find((f) => f.status === 'verified');
      if (!totp) {
        router.replace(`/mfa/setup?returnUrl=${encodeURIComponent(returnUrl)}`);
        return;
      }

      // Lanzar desafío
      const { data: chal, error } = await supabase.auth.mfa.challenge({ factorId: totp.id });
      if (error) {
        setErrorMsg(error.message || 'No se pudo iniciar el desafío MFA');
        setLoading(false);
        return;
      }
      setFactorId(totp.id);
      setChallengeId(chal.id);
      setLoading(false);
    };
    run();
  }, [router, returnUrl]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const digits = code.replace(/\D/g, '');
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: digits,
    });
    if (error) {
      setErrorMsg(error.message || 'Código incorrecto. Verificá la hora del dispositivo.');
      return;
    }

    await supabase.auth.getSession();
    const { data: aal2 } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    router.replace(aal2?.currentLevel === 'aal2' ? returnUrl : '/home');
  };

  const handleCancel = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace('/login?canceledMfa=1');
  };

  if (loading) return <div style={{ padding: 24 }}>Verificando MFA...</div>;

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: 16 }}>
      <h1>Verificar MFA</h1>
      <form onSubmit={onSubmit} style={{ marginTop: 12 }}>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Código de 6 dígitos"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={{ width: '100%', padding: 8 }}
          required
        />
        {errorMsg && <p style={{ color: 'crimson' }}>{errorMsg}</p>}
        <button type="submit" style={{ marginTop: 12, width: '100%', padding: 10 }}>
          Verificar y continuar
        </button>
      </form>
      <button type="button" onClick={handleCancel} style={{ marginTop: 12, width: '100%', padding: 10, background: '#eee' }}>
        Cancelar y cambiar usuario
      </button>
    </div>
  );
}