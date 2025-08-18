import Head from 'next/head';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Index() {
  const router = useRouter();
  useEffect(() => { router.replace('/home'); }, [router]);
  return (
    <>
      <Head><title>Loza Orellano</title></Head>
      <div style={{ padding: 24 }}>Redirigiendo a Home…</div>
    </>
  );
}