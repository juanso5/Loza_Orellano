import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });

  const body = req.body;
  if (!body || !Array.isArray(body.rows)) return res.status(400).json({ error: 'Invalid payload' });
  const rows = body.rows.map(r => ({
    especie: r.especie ? String(r.especie).trim() : null,
    precio: typeof r.precio === 'number' ? r.precio : Number(r.precio || 0),
    nominal: typeof r.nominal === 'number' ? r.nominal : Number(r.nominal || 0),
    cliente: r.cliente ? String(r.cliente).trim() : null,
  })).filter(r => r.especie);

  // Try to use Supabase if token provided; otherwise demo mode
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.split(' ')[1] : null;

  if (!token || !supabaseUrl || !supabaseAnonKey) {
    // Demo mode: pretend everything is fine
    return res.status(200).json({ message: `Demo: recibidas ${rows.length} filas (no se insertó en DB).` });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  await supabase.auth.setAuth(token);

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      // Sin usuario válido => demo
      return res.status(200).json({ message: `Demo: recibidas ${rows.length} filas (token inválido, no se insertó en DB).` });
    }
    const user = userData.user;
    const normalized = rows.map(r => ({ ...r, user_id: user.id }));

    const BATCH = 500;
    for (let i = 0; i < normalized.length; i += BATCH) {
      const batch = normalized.slice(i, i + BATCH);
      const { error } = await supabase.from('movimientos').insert(batch);
      if (error) {
        console.error('Insert error', error);
        return res.status(500).json({ error: 'Error inserting batch', details: error });
      }
    }
    return res.status(200).json({ message: `Importadas ${normalized.length} filas.` });
  } catch (err) {
    console.error('Unexpected error', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message || err });
  }
}
