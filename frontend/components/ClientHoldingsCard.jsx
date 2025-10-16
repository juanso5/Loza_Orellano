'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMovements } from './MovementsProvider';
function fmtCurrency(n) {
  return Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
}
function fmtNumber(n) {
  return Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
}
export default function ClientHoldingsCard({ client, onAdd }) {
  const { pricesMap, tick, normalizeSimple } = useMovements();
  const rootRef = useRef(null);
  const [visible, setVisible] = useState(false);   // NUEVO: visible en viewport
  const [hasLoaded, setHasLoaded] = useState(false); // NUEVO: ya cargó datos
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [funds, setFunds] = useState([]); // [{id, name}]
  const [movs, setMovs] = useState([]);   // movimientos del cliente
  // Observa entrada al viewport para cargar perezoso
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let disconnected = false;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !disconnected) {
          setVisible(true);
          io.disconnect();
          disconnected = true;
        }
      });
    }, { root: null, rootMargin: '200px' }); // prefetch 200px antes
    io.observe(el);
    return () => { try { io.disconnect(); } catch {} };
  }, []);
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rf, rm] = await Promise.all([
        fetch(`/api/fondo?cliente_id=${client.id}`, { cache: 'no-store' }),
        fetch(`/api/movimiento?cliente_id=${client.id}&limit=10000`, { cache: 'no-store' }),
      ]);
      const jf = await rf.json();
      const jm = await rm.json();
      const fundsArr = (Array.isArray(jf?.data) ? jf.data : []).map(f => ({
        id: Number(f.id ?? f.id_fondo ?? f.fondo_id ?? 0),
        name: f?.nombre || f?.tipo_cartera?.descripcion || f?.descripcion || f?.name || `Cartera ${f?.id ?? ''}`,
      }));
      const movArr = (Array.isArray(jm?.data) ? jm.data : []).map(m => ({
        fondo_id: Number(m.fondo_id) || null,
        tipo_mov: String(m.tipo_mov || '').toLowerCase(), // compra/venta
        nominal: Number(m.nominal) || 0,
        especie: (m.especie || '').toString(),
      }));
      setFunds(fundsArr);
      setMovs(movArr);
      setHasLoaded(true);
    } catch {
      setFunds([]);
      setMovs([]);
    } finally {
      setLoading(false);
    }
  }, [client.id]);
  // Cargar al hacerse visible por primera vez o al expandir
  useEffect(() => {
    if ((visible || expanded) && !hasLoaded) {
      loadData();
    }
  }, [visible, expanded, hasLoaded, loadData]);
  // Si cambian movimientos globales (tick), refrescar si ya cargó (y está visible/expandido)
  useEffect(() => {
    if ((visible || expanded) && hasLoaded) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  // Agregación + valorización
  const { byPortfolio, totalValue } = useMemo(() => {
    // Mapa: pid -> Map(especieLower -> { name, nominal, value })
    const portMap = new Map();
    const getSigned = (tipo, n) => (tipo === 'venta' ? -1 : 1) * Number(n || 0);
    for (const m of movs) {
      const pid = Number(m.fondo_id) || null;
      if (!pid) continue;
      const name = (m.especie || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      let inner = portMap.get(pid);
      if (!inner) { inner = new Map(); portMap.set(pid, inner); }
      const prev = inner.get(key) || { name, nominal: 0, value: 0 };
      prev.nominal += getSigned(m.tipo_mov, m.nominal);
      inner.set(key, prev);
    }
    // Valorización con pricesMap
    let total = 0;
    portMap.forEach((inner) => {
      inner.forEach((rec, k) => {
        if (rec.nominal <= 0) { inner.delete(k); return; }
        const nk = normalizeSimple(rec.name);
        const price = pricesMap[nk] ?? pricesMap[rec.name] ?? undefined;
        rec.value = price !== undefined ? rec.nominal * Number(price) : NaN;
        if (!Number.isNaN(rec.value)) total += rec.value;
      });
    });
    return { byPortfolio: portMap, totalValue: total };
  }, [movs, pricesMap, normalizeSimple]);
  // Render
  const initials = client.name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <article ref={rootRef} className="client-card" style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
      <div className="client-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: '#fff' }}>
        <div className="client-left" style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
          <div className="avatar" style={{ width: 40, height: 40, borderRadius: 20, background: '#eef2f6', display: 'grid', placeItems: 'center', fontWeight: 700, color: '#475569' }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="client-title" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {client.name}
            </div>
            <div className="client-total" style={{ color: '#0f172a', fontWeight: 700 }}>
              {fmtCurrency(totalValue)}
            </div>
          </div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" title="Agregar movimiento" onClick={() => onAdd?.(client.id)}>
            <i className="fas fa-plus" />
          </button>
          <button
            type="button"
            className="btn"
            title={expanded ? 'Cerrar' : 'Abrir'}
            onClick={() => setExpanded(e => !e)}
            aria-expanded={expanded}
          >
            <i className={expanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down'} />
          </button>
        </div>
      </div>
      {expanded && (
        // Forzar display:block para evitar estilos globales que ocultan .client-body
        <div className="client-body" style={{ display: 'block', background: '#fff' }}>
          {loading ? (
            <div className="muted" style={{ padding: 12 }}>Cargando…</div>
          ) : funds.length === 0 ? (
            <div className="muted" style={{ padding: 12 }}>Sin carteras</div>
          ) : (
            funds.map((f) => {
              const inner = byPortfolio.get(Number(f.id)) || new Map();
              const items = Array.from(inner.values())
                .filter(x => Number(x.nominal) > 0)
                .sort((a, b) => a.name.localeCompare(b.name, 'es'));
              return (
                <div key={f.id} className="fund-block" style={{ padding: '8px 12px' }}>
                  <h4 style={{ margin: '6px 0' }}>{f.name}</h4>
                  {items.length === 0 ? (
                    <div className="muted">Sin posiciones</div>
                  ) : (
                    <ul className="fund-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {items.map((it) => (
                        <li key={it.name} style={{
                          display: 'grid', gridTemplateColumns: 'minmax(0,1fr) max-content max-content',
                          columnGap: 12, alignItems: 'center', padding: '6px 8px'
                        }}>
                          <span className="especie-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {it.name}
                          </span>
                          <strong className="especie-qty">{fmtNumber(it.nominal)}</strong>
                          <span className="especie-value">
                            {Number.isNaN(it.value) ? ' - ' : fmtCurrency(it.value)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </article>
  );
}