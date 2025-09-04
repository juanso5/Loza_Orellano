'use client';
import { useEffect, useMemo, useState } from 'react';
import { useMovements } from '../components/MovementsProvider';
import ClientList from '../components/ClientList';

export default function ClientsPanel({ onSelectClient }) {
  const { clientIdFilter, setClientIdFilter } = useMovements();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/cliente', { cache: 'no-store' });
        if (!res.ok) throw new Error('Error cargando clientes');
        const json = await res.json();
        // el API puede traer data ya formateada
        const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        // Asegurar shape mínima
        const norm = list.map((c) => ({
          id: Number(c.id ?? c.id_cliente ?? c.id) || 0,
          name: c.name || c.nombre || '',
          portfolios: Array.isArray(c.portfolios) ? c.portfolios : [],
          movements: Array.isArray(c.movements) ? c.movements : [],
        }));
        if (!ignore) setClients(norm);
      } catch (e) {
        if (!ignore) setClients([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => { ignore = true; };
  }, []);

  const filtered = useMemo(() => {
    const s = (q || '').toLowerCase();
    if (!s) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(s));
  }, [clients, q]);

  return (
    <aside className="card clients-column" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="card-header" style={{ padding: 12, borderBottom: '1px solid #eef2f6' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente…"
            className="search-input"
            style={{ flex: 1, minWidth: 0 }}
          />
          {clientIdFilter != null && (
            <button
              className="btn-small"
              onClick={() => setClientIdFilter(null)}
              title="Quitar filtro"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: 12 }}>
        {loading ? (
          <div className="muted">Cargando clientes…</div>
        ) : filtered.length === 0 ? (
          <div className="muted">Sin resultados</div>
        ) : (
          <ClientList
            clients={filtered}
            searchQuery={q}
            selectedClientId={clientIdFilter ?? null}
            onSelectClient={(id) => {
              setClientIdFilter(id);
              onSelectClient?.(id);
            }}
          />
        )}
      </div>
    </aside>
  );
}