'use client';
import { useEffect, useRef, useState } from 'react';
import { MovementsProvider, useMovements } from './MovementsProvider';
import LastMovementsTable from './LastMovementsTable';
import useDebouncedValue from './useDebouncedValue';
import ClientsPanel from './ClientsPanel';
import ClientsHoldingsList from './ClientsHoldingsList';
import MovementModal from './MovementModal';
import CSVPrecioImport from './CSVPrecioImport';
function Toolbar({ onAdd, viewMode, setViewMode }) {
  const fileRef = useRef(null);
  const { query, setQuery, uploadState, setUploadState, refreshFirstPage, refreshPrices } = useMovements();
  const debouncedQuery = useDebouncedValue(query, 280);
  useEffect(() => {}, [debouncedQuery]);
  const onFileClick = () => fileRef.current?.click();
  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadState({ status: 'parsing', message: 'Procesando CSVÔÇª' });
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
      setUploadState({ status: 'uploading', message: 'Enviando preciosÔÇª' });
      const res = await fetch('/api/movimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsertPrecios', fecha, fuente: 'csv', items }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Error al guardar precios');
      }
      const result = await res.json();
      const mensaje = result.message || 'Precios actualizados';
      if (result.errores && result.errores.length > 0) {
        }
      setUploadState({ status: 'done', message: mensaje });
      await refreshPrices();       // NUEVO: volver a leer precios desde DB y notificar
      refreshFirstPage();          // refrescar primeras p├íginas por si hay dependencias
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
        <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 6, padding: 2 }}>
          <button 
            className={viewMode === 'holdings' ? 'btn primary' : 'btn secondary'}
            onClick={() => setViewMode('holdings')}
            style={{ fontSize: '0.875rem', padding: '6px 12px' }}
            title="Vista por Holdings"
          >
            <i className="fas fa-chart-pie" /> Holdings
          </button>
          <button 
            className={viewMode === 'movements' ? 'btn primary' : 'btn secondary'}
            onClick={() => setViewMode('movements')}
            style={{ fontSize: '0.875rem', padding: '6px 12px' }}
            title="Últimos Movimientos"
          >
            <i className="fas fa-list" /> Movimientos
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".csv" onChange={onFileChange} style={{ display: 'none' }} />
        <div className="csv-status" aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <small>
            {uploadState.status === 'parsing' && 'Procesando CSVÔÇª'}
            {uploadState.status === 'uploading' && 'Enviando preciosÔÇª'}
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
function MovementsContent({ onSelectClient, onAdd, viewMode }) {
  const { filteredItems, loading, error, fetchNextPage, hasMore, deleteMovement } = useMovements();
  if (viewMode === 'holdings') {
    return (
      <div style={{ 
        width: '100%', 
        maxWidth: 1200, 
        margin: '0 auto',
        padding: '0 20px'
      }}>
        <ClientsHoldingsList onAdd={onAdd} />
      </div>
    );
  }
  return (
    <>
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
  const [viewMode, setViewMode] = useState('holdings'); // 'holdings' | 'movements'
  const [showPrecioImport, setShowPrecioImport] = useState(false);
  const openAddFor = (clientId) => {
    setPrefClient(clientId ?? null);
    setAddOpen(true);
  };
  return (
    <MovementsProvider>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
        <Toolbar onAdd={() => openAddFor(prefClient)} viewMode={viewMode} setViewMode={setViewMode} />
        {/* Botón para abrir import de precios */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button 
            className="btn secondary"
            onClick={() => setShowPrecioImport(!showPrecioImport)}
            style={{ fontSize: '0.875rem' }}
          >
            <i className={showPrecioImport ? 'fas fa-chevron-up' : 'fas fa-chevron-down'} />
            {' '}
            {showPrecioImport ? 'Ocultar' : 'Importar'} Precios desde CSV (Inviu)
          </button>
        </div>
        {/* Componente de import colapsable */}
        {showPrecioImport && (
          <div style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
            <CSVPrecioImport />
          </div>
        )}
        <MovementsContent
          onSelectClient={(id) => setPrefClient(id)}
          onAdd={(clientId) => openAddFor(clientId)}
          viewMode={viewMode}
        />
      </div>
      <MovementModal open={addOpen} onClose={() => setAddOpen(false)} defaultClientId={prefClient ?? undefined} />
    </MovementsProvider>
  );
}
