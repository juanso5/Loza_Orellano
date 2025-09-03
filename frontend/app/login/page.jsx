export const dynamic = 'force-dynamic';
import LoginClient from './LoginClient';

export default function Page({ searchParams }) {
  const redirectedFrom =
    searchParams?.returnUrl || searchParams?.redirectedFrom || '/home';
  return <LoginClient redirectedFrom={redirectedFrom} />;
}