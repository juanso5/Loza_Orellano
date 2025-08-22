// app/login/page.jsx (Server Component wrapper)
export const dynamic = 'force-dynamic';

import LoginClient from './LoginClient';

export default async function LoginPage({ searchParams }) {
  // In Next.js 15, searchParams is async. Await it before using.
  const sp = await searchParams;
  const redirectedFrom = sp?.redirectedFrom || '/home';
  return <LoginClient redirectedFrom={redirectedFrom} />;
}
