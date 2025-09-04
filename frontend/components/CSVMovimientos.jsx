'use client';
import { useEffect, useRef, useState } from 'react';
import { MovementsProvider, useMovements } from './MovementsProvider';
import LastMovementsTable from './LastMovementsTable';
import useDebouncedValue from './useDebouncedValue';
import ClientsPanel from './ClientsPanel'
import MovementModal from './MovementModal';                            
import ClientsHoldingsList from './ClientsHoldingsList';

function Toolbar({ onAdd }) {
  const fileRef = useRef(null);
  const { query, setQuery, uploadState, setUploadState, refreshFirstPage, refreshPrices } = useMovements();
  const debouncedQuery = useDebouncedValue(query, 280);
  useEffect(() => {}, [debouncedQuery]);

  const onFileClick = () => fileRef.current?.click();

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadState({ status: 'parsing', message: 'Procesando CSV…' });
    try {
      const worker = new Worker(new URL('./csvWorker.js', import.meta.url), { type: 'module' });
      const text = await file.text();
      const parseInWorker = () =>
        new Promise((resolve, reject) => {
          worker.onmessage = (ev) => {
            const { type, payload, error } = ev.data || {};
            if (type === 'result') { worker.terminate(); resolve(payload); }
            if (type === 'error') { worker.terminate(); reject(error || 'Error parseando CSV'); }
          };
          worker.postMessage({ type: 'parse', payload: { csv: text } });
        });
      const { fecha, items } = await parseInWorker();
      setUploadState({ status: 'uploading', message: 'Enviando precios…' });
      const res = await fetch('/api/movimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsertPrecios', fecha, fuente: 'csv', items }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Error al guardar precios');
      }
      setUploadState({ status: 'done', message: 'Precios actualizados' });
      await refreshPrices();       // NUEVO: volver a leer precios desde DB y notificar
      refreshFirstPage();          // refrescar primeras páginas por si hay dependencias
    } catch (err) {
      setUploadState({ status: 'error', message: err?.message || String(err) });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
      setTimeout(() => setUploadState({ status: 'idle', message: '' }), 3000);
    }
  };

  return (
    <header className="page-header">
      <div className="page-left"><h1>Movimientos</h1></div>
      <div className="page-right" style={{ gap: 8, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={onAdd} title="Agregar Movimiento">
          <i className="fas fa-plus" /> Agregar Movimiento
        </button>
        <button className="btn secondary" onClick={onFileClick} title="Cargar precios CSV">
          <i className="fas fa-file-csv" /> Cargar precios CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv" onChange={onFileChange} style={{ display: 'none' }} />
        <div className="csv-status" aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <small>
            {uploadState.status === 'parsing' && 'Procesando CSV…'}
            {uploadState.status === 'uploading' && 'Enviando precios…'}
            {uploadState.status === 'done' && 'Precios actualizados'}
            {uploadState.status === 'error' && <span style={{ color: '#b00' }}>{uploadState.message}</span>}
          </small>
        </div>
        <input
          className="search-input"
          placeholder="Buscar por cliente"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ minWidth: 260 }}
        />
      </div>
    </header>
  );
}

function MovementsContent({ onSelectClient, onAdd }) {
  const { filteredItems, loading, error, fetchNextPage, hasMore, deleteMovement } = useMovements();

  return (
    <>
      {/* NUEVO: resumen por cliente (precios y total patrimonio) */}
      <ClientsHoldingsList onAdd={onAdd} />

      {/* Layout con panel de clientes + tabla virtualizada */}
      <div className="fondos-layout" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
        <ClientsPanel onSelectClient={onSelectClient} />
        <main className="content-area">
          <section className="last-movements-section">
            <h2>Últimos movimientos</h2>
            <div className="table-wrap" style={{ padding: 0 }}>
              <LastMovementsTable
                rows={filteredItems}
                onReachEnd={() => { if (!loading && hasMore) fetchNextPage(); }}
                onDelete={(id) => deleteMovement(id)}
                loading={loading}
                error={error}
              />
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

export default function CSVMovimientos() {
  const [addOpen, setAddOpen] = useState(false);
  const [prefClient, setPrefClient] = useState(null);

  const openAddFor = (clientId) => {
    setPrefClient(clientId ?? null);
    setAddOpen(true);
  };

  return (
    <MovementsProvider>
      <Toolbar onAdd={() => openAddFor(prefClient)} />
      <MovementsContent
        onSelectClient={(id) => setPrefClient(id)}
        onAdd={(clientId) => openAddFor(clientId)}
      />
      <MovementModal open={addOpen} onClose={() => setAddOpen(false)} defaultClientId={prefClient ?? undefined} />
    </MovementsProvider>
  );
}