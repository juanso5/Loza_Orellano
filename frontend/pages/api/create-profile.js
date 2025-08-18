import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });

  const token = (() => {
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) return auth.split(' ')[1];
    return req.headers['x-supabase-auth'];
  })();

  if (!token) return res.status(401).json({ error: 'No auth token provided' });

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  await supabase.auth.setAuth(token);

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return res.status(401).json({ error: 'Invalid user token' });

    const body = req.body;
    if (!body || !body.email) return res.status(400).json({ error: 'Invalid payload' });

    const profile = {
      id: userData.user.id,
      email: body.email,
      nombre: body.nombre || null
    };

    const { error } = await supabase.from('profiles').upsert(profile);
    if (error) return res.status(500).json({ error: 'Error upserting profile', details: error });
    return res.status(200).json({ ok: true, profile });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal error', details: err.message || err });
  }
}
