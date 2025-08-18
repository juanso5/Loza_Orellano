import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    return res.status(401).json({ error: 'No session' });
  }
  return res.status(200).json({ access_token: data.session.access_token });
}
