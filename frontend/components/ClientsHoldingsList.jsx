'use client';
import { useEffect, useMemo, useState } from 'react';
import { useMovements } from './MovementsProvider';
import ClientHoldingsCard from './ClientHoldingsCard';

export default function ClientsHoldingsList({ onAdd }) {
  const { query } = useMovements();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/cliente', { cache: 'no-store' });
        const j = await res.json();
        const list = Array.isArray(j?.data) ? j.data : [];
        const norm = list.map((c) => ({
          id: Number(c.id ?? c.id_cliente ?? 0),
          name: c.name || c.nombre || '',
        })).filter(c => c.id && c.name);
        if (!ignore) setClients(norm);
      } catch {
        if (!ignore) setClients([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c => c.name.toLowerCase().includes(q));
  }, [clients, query]);

  if (loading) return <div className="muted" style={{ padding: 8 }}>Cargando clientes…</div>;
  if (filtered.length === 0) return <div className="muted" style={{ padding: 8 }}>Sin clientes</div>;

  return (
    <section aria-label="Patrimonio por cliente" style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
      {filtered.map(c => (
        <ClientHoldingsCard key={c.id} client={c} onAdd={onAdd} />
      ))}
    </section>
  );
}