import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Logout() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      await supabase.auth.signOut();
      router.push('/login');
    })();
  }, [router]);
  return <div style={{ padding: 24 }}>Cerrando sesión...</div>;
}
