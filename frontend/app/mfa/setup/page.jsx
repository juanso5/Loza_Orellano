'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '../../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

export default function MfaSetupPage() {
  const router = useRouter();
  const search = useSearchParams();
  const returnUrl = search?.get('returnUrl') || '/home';

  const [loading, setLoading] = useState(true);
  const [enrollError, setEnrollError] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login?reason=need-auth');
        return;
      }

      // Gateo: si el email no está verificado, ir a verify-email
      const emailConfirmed = user.email_confirmed_at || user.confirmed_at;
      if (!emailConfirmed) {
        router.replace(`/verify-email?returnUrl=${encodeURIComponent(returnUrl)}`);
        return;
      }

      // Si ya tiene TOTP verificado, ir a verificar (elevar AAL)
      const { data: factorsData, error: lfErr } = await supabase.auth.mfa.listFactors();
      if (lfErr) {
        setEnrollError(lfErr.message);
        setLoading(false);
        return;
      }
      const verified = factorsData?.totp?.find((f) => f.status === 'verified');
      if (verified) {
        router.replace(`/mfa/verify?returnUrl=${encodeURIComponent(returnUrl)}`);
        return;
      }

      // Limpia residuos unverified extra
      const unverified = (factorsData?.totp || []).filter((f) => f.status === 'unverified');
      if (unverified.length > 1) {
        await Promise.all(
          unverified.slice(0, -1).map((f) => supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {}))
        );
      }

      // Reusar unverified o crear uno nuevo
      let enrollFactor = null;
      {
        const { data: f2 } = await supabase.auth.mfa.listFactors();
        enrollFactor = (f2?.totp || []).find((f) => f.status === 'unverified') || null;
      }
      if (!enrollFactor) {
        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: `TOTP-${Date.now()}`,
        });
        if (error) {
          setEnrollError(error.message || 'No se pudo iniciar el enrolamiento TOTP');
          setLoading(false);
          return;
        }
        enrollFactor = data;
      }

      setFactorId(enrollFactor.id);
      setTotpUri(enrollFactor.totp.uri);
      setLoading(false);
    };
    run();
  }, [router, returnUrl]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setVerifyError('');
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    // Reconfirma factor actual
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const current = (factors?.totp || []).find((f) => f.status === 'unverified') || null;
    const useFactorId = current?.id || factorId;

    const digits = code.replace(/\D/g, '');

    // Verificación de enrolamiento + fallback con challengeId
    let { error } = await supabase.auth.mfa.verify({ factorId: useFactorId, code: digits });
    if (error) {
      const { data: chal } = await supabase.auth.mfa.challenge({ factorId: useFactorId });
      if (chal?.id) {
        const res2 = await supabase.auth.mfa.verify({
          factorId: useFactorId,
          challengeId: chal.id,
          code: digits,
        });
        error = res2.error;
      }
    }
    if (error) {
      setVerifyError(error.message || 'Código inválido. Verificá la hora del dispositivo.');
      return;
    }
    router.replace(`/mfa/verify?returnUrl=${encodeURIComponent(returnUrl)}`);
  };

  const handleCancel = async () => {
    const supabase = getSupabaseBrowserClient();
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const unverified = factors?.totp?.filter((f) => f.status === 'unverified') || [];
      await Promise.all(unverified.map((f) => supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {})));
    } catch {}
    await supabase.auth.signOut();
    router.replace('/login?canceledMfa=1');
  };

  if (loading) return <div style={{ padding: 24 }}>Configurando TOTP...</div>;

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: 16 }}>
      <h1>Configurar MFA (TOTP)</h1>
      {enrollError && <p style={{ color: 'crimson' }}>{enrollError}</p>}
      {!!totpUri && (
        <>
          <p>Escaneá este QR con tu app autenticadora y luego ingresá el primer código:</p>
          <img
            alt="TOTP QR"
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpUri)}`}
            width={180}
            height={180}
          />
          <p style={{ fontSize: 12, color: '#666' }}>Si no podés escanear, agregá manualmente esta URI: {totpUri}</p>
          <form onSubmit={handleVerify} style={{ marginTop: 12 }}>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Código de 6 dígitos"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ width: '100%', padding: 8 }}
              required
            />
            {verifyError && <p style={{ color: 'crimson' }}>{verifyError}</p>}
            <button type="submit" style={{ marginTop: 12, width: '100%', padding: 10 }}>
              Confirmar y continuar
            </button>
          </form>
          <button type="button" onClick={handleCancel} style={{ marginTop: 12, width: '100%', padding: 10, background: '#eee' }}>
            Cancelar y cambiar usuario
          </button>
        </>
      )}
    </div>
  );
}