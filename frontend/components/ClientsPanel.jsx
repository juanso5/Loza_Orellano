'use client';
import { useEffect, useMemo, useState } from 'react';
import { useMovements } from '../components/MovementsProvider';
import ClientList from '../components/ClientList';
import { fetchAllClientsWithData, filterClientsByQuery } from '@/lib/clientHelpers';
export default function ClientsPanel({ onSelectClient }) {
  const { clientIdFilter, setClientIdFilter, tick } = useMovements();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  // Recargar clientes cuando cambie tick (movimientos agregados/eliminados)
  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setLoading(true);
      try {
        const clientsWithData = await fetchAllClientsWithData();
        if (!ignore) setClients(clientsWithData);
      } catch (e) {
        if (!ignore) setClients([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => { ignore = true; };
  }, [tick]); // Recargar cuando cambien movimientos
  const filtered = useMemo(() => {
    return filterClientsByQuery(clients, q);
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