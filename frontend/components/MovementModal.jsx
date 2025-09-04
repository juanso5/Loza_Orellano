'use client';
import { useEffect, useMemo, useState } from 'react';
// ...existing code...
import { useMovements } from './MovementsProvider'; // corrige ruta

function toISODateTimeLocal(val) {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function MovementModal({ open, onClose, defaultClientId }) {
  const { refreshFirstPage, setClientIdFilter } = useMovements();

  // Datos para selects
  const [clients, setClients] = useState([]);
  const [funds, setFunds] = useState([]);

  // Estado del formulario (igual a Fondos)
  const [clienteId, setClienteId] = useState(defaultClientId ?? null);
  const [fondoId, setFondoId] = useState(null);
  const [fecha, setFecha] = useState(() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [tipo, setTipo] = useState('Ingreso'); // Ingreso | Egreso
  const [especieSel, setEspecieSel] = useState('');
  const [especieNueva, setEspecieNueva] = useState('');
  const [nominal, setNominal] = useState('');
  const [precioUsd, setPrecioUsd] = useState('');

  const [loading, setLoading] = useState(false);

  // Cargar clientes al abrir
  useEffect(() => {
    if (!open) return;
    let ignore = false;
    (async () => {
      try {
        const res = await fetch('/api/cliente', { cache: 'no-store' });
        const j = await res.json();
        const list = Array.isArray(j?.data) ? j.data : [];
        const norm = list.map((c) => ({
          id: Number(c.id ?? c.id_cliente ?? 0),
          name: c.name || c.nombre || '',
        }));
        if (!ignore) {
          setClients(norm);
          // preselección
          const pre = defaultClientId != null ? Number(defaultClientId) : (norm[0]?.id ?? null);
          setClienteId(pre || null);
        }
      } catch {
        if (!ignore) setClients([]);
      }
    })();
    return () => { ignore = true; };
  }, [open, defaultClientId]);

  // Cargar carteras del cliente
  useEffect(() => {
    if (!open || !clienteId) { setFunds([]); setFondoId(null); return; }
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/fondo?cliente_id=${clienteId}`, { cache: 'no-store' });
        const j = await res.json();
        const arr = Array.isArray(j?.data) ? j.data : [];
        const norm = arr.map((f) => ({
          id: Number(f.id ?? f.id_fondo ?? f.fondo_id ?? 0),
          name: f?.descripcion || f?.name || f?.tipo_cartera?.descripcion || `Cartera ${f?.id ?? ''}`,
        }));
        if (!ignore) {
          setFunds(norm);
          setFondoId(norm[0]?.id ?? null);
        }
      } catch {
        if (!ignore) setFunds([]);
      }
    })();
    return () => { ignore = true; };
  }, [open, clienteId]);

  // Movimientos del cliente para calcular disponibles por cartera/especie
  const [availableByKey, setAvailableByKey] = useState(new Map()); // key = `${pid}|${especieLower}`
  useEffect(() => {
    if (!open || !clienteId) { setAvailableByKey(new Map()); return; }
    let ignore = false;
    (async () => {
      try {
        const r = await fetch(`/api/movimiento?cliente_id=${clienteId}`, { cache: 'no-store' });
        const j = await r.json();
        const data = Array.isArray(j?.data) ? j.data : [];
        const map = new Map();
        for (const m of data) {
          const pid = Number(m.fondo_id) || null;
          const especie = String(m.especie || '').trim();
          if (!pid || !especie) continue;
          const key = `${pid}|${especie.toLowerCase()}`;
          const delta = (String(m.tipo_mov || '').toLowerCase() === 'venta' ? -1 : 1) * (Number(m.nominal) || 0);
          map.set(key, (map.get(key) || 0) + delta);
        }
        if (!ignore) setAvailableByKey(map);
      } catch {
        if (!ignore) setAvailableByKey(new Map());
      }
    })();
    return () => { ignore = true; };
  }, [open, clienteId]);

  // Opciones de especie para la cartera seleccionada (solo las con nominal > 0)
  const speciesOptions = useMemo(() => {
    if (!fondoId) return [];
    const out = [];
    availableByKey.forEach((val, key) => {
      const [pidStr, especieLower] = key.split('|');
      if (Number(pidStr) === Number(fondoId) && val > 0) {
        out.push(especieLower); // ya en lower
      }
    });
    // capitalizar simple para UI
    const uniq = Array.from(new Set(out)).map((s) => s);
    return uniq.sort((a, b) => a.localeCompare(b, 'es'));
  }, [availableByKey, fondoId]);

  // Texto de hint de disponibles (solo en Egreso y cuando hay especie seleccionada/existente)
  const availableHint = useMemo(() => {
    if (tipo !== 'Egreso' || !fondoId) return '';
    const especie = (especieNueva?.trim() || especieSel?.trim() || '').toLowerCase();
    if (!especie) return '';
    const key = `${Number(fondoId)}|${especie}`;
    const avail = Number(availableByKey.get(key) || 0);
    if (avail <= 0) return 'No hay unidades disponibles de esa especie en la cartera seleccionada.';
    return `Disponibles: ${avail.toLocaleString('es-AR', { maximumFractionDigits: 2 })} unidades.`;
  }, [tipo, fondoId, especieSel, especieNueva, availableByKey]);

  const canSave = useMemo(() => {
    const especie = (especieNueva?.trim() || especieSel?.trim() || '');
    // Igual que en Fondos: nominal entero > 0
    const n = Number.isFinite(Number(nominal)) ? Math.trunc(Number(nominal)) : 0;
    return clienteId && fondoId && fecha && especie && n > 0;
  }, [clienteId, fondoId, fecha, especieSel, especieNueva, nominal]);

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    if (!canSave || loading) return;

    const especie = (especieNueva?.trim() || especieSel?.trim() || '').toLowerCase();
    const qty = Math.trunc(Number(nominal) || 0);

    if (tipo === 'Egreso') {
      const key = `${Number(fondoId)}|${especie}`;
      const avail = Number(availableByKey.get(key) || 0);
      if (qty > avail) {
        alert(`No podés vender más de ${avail.toLocaleString('es-AR', { maximumFractionDigits: 2 })} unidades.`);
        return;
      }
    }

    setLoading(true);
    try {
      const body = {
        cliente_id: Number(clienteId),
        fondo_id: Number(fondoId),
        fecha_alta: toISODateTimeLocal(fecha),
        precio_usd: precioUsd === '' ? null : Number(precioUsd),
        tipo_mov: tipo === 'Egreso' ? 'venta' : 'compra',
        especie,
        nominal: qty, // entero
      };
      const res = await fetch('/api/movimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let errText = 'No se pudo crear el movimiento';
        try {
          const j = await res.json();
          errText = j?.error || errText;
        } catch {}
        throw new Error(errText);
      }

      // Refrescar lista y filtrar por cliente (igual UX que Fondos)
      setClientIdFilter(Number(clienteId));
      refreshFirstPage();

      // Limpiar y cerrar
      setEspecieSel(''); setEspecieNueva('');
      setNominal(''); setPrecioUsd('');
      onClose?.();
    } catch (e2) {
      alert(e2?.message || 'Error creando movimiento');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      className="mmodal-overlay"
    >
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        className="mmodal-card"
      >
        <header className="mmodal-header">
          <h3 className="mmodal-title">Agregar movimiento</h3>
          <button type="button" onClick={onClose} className="mmodal-close" aria-label="Cerrar">
            <i className="fas fa-times" />
          </button>
        </header>

        <div className="mmodal-body">
          <div className="mmodal-grid">
            <label className="mmodal-field">
              <span className="mmodal-label">
                Cliente <span aria-hidden="true" className="req">*</span>
              </span>
              <select
                value={clienteId ?? ''}
                onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : null)}
                required
                className="mmodal-input"
              >
                {clients.length === 0 && <option value="">Seleccioná…</option>}
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>

            <label className="mmodal-field">
              <span className="mmodal-label">
                Cartera <span aria-hidden="true" className="req">*</span>
              </span>
              <select
                value={fondoId ?? ''}
                onChange={(e) => setFondoId(e.target.value ? Number(e.target.value) : null)}
                required
                className="mmodal-input"
              >
                {!clienteId && <option value="">Elegí un cliente primero</option>}
                {clienteId && funds.length === 0 && <option value="">Sin carteras</option>}
                {funds.length > 0 && <option value="">-- Seleccionar cartera --</option>}
                {funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </label>

            <label className="mmodal-field">
              <span className="mmodal-label">
                Fecha y hora <span aria-hidden="true" className="req">*</span>
              </span>
              <input
                type="datetime-local"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                className="mmodal-input"
              />
            </label>

            <label className="mmodal-field">
              <span className="mmodal-label">
                Tipo <span aria-hidden="true" className="req">*</span>
              </span>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="mmodal-input"
              >
                <option value="Ingreso">Ingreso</option>
                <option value="Egreso">Egreso</option>
              </select>
            </label>

            <label className="mmodal-field">
              <span className="mmodal-label">
                Especie <span aria-hidden="true" className="req">*</span>
              </span>
              <div className="mmodal-inline">
                <select
                  value={especieSel}
                  onChange={(e) => setEspecieSel(e.target.value)}
                  className="mmodal-input"
                >
                  <option value="">-- Seleccionar especie --</option>
                  {speciesOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <input
                  placeholder="Nombre nueva especie..."
                  value={especieNueva}
                  onChange={(e) => setEspecieNueva(e.target.value)}
                  className="mmodal-input"
                />
              </div>
              {availableHint && (
                <small aria-live="polite" className="mmodal-hint">{availableHint}</small>
              )}
            </label>

            <label className="mmodal-field">
              <span className="mmodal-label">
                Nominal <span aria-hidden="true" className="req">*</span>
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={nominal}
                onChange={(e) => setNominal(e.target.value)}
                required
                className="mmodal-input"
              />
            </label>

            <label className="mmodal-field">
              <span className="mmodal-label">Tipo de cambio (precio_usd)</span>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="1.00"
                value={precioUsd}
                onChange={(e) => setPrecioUsd(e.target.value)}
                className="mmodal-input"
              />
            </label>
          </div>
        </div>

        <footer className="mmodal-footer">
          <button type="button" className="mmodal-btn" onClick={onClose}>
            <i className="fas fa-times" /> Cancelar
          </button>
          <button type="submit" className="mmodal-btn primary" disabled={!canSave || loading}>
            <i className="fas fa-check" /> {loading ? 'Guardando…' : 'Guardar'}
          </button>
        </footer>
      </form>

      <style jsx>{`
        .mmodal-overlay {
          position: fixed; inset: 0; z-index: 10000;
          background: rgba(0,0,0,.35);
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: saturate(120%) blur(2px);
        }
        .mmodal-card {
          width: 820px; max-width: calc(100vw - 32px);
          background: #fff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.18);
          display: grid; grid-template-rows: auto 1fr auto;
          overflow: hidden;
        }
        .mmodal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px; border-bottom: 1px solid #eef2f6;
        }
        .mmodal-title { margin: 0; font-size: 20px; font-weight: 700; color: #0f172a; }
        .mmodal-close { border: 0; background: transparent; padding: 8px; cursor: pointer; color: #64748b; }
        .mmodal-close:hover { color: #0f172a; }
        .mmodal-body { padding: 14px 16px; }
        .mmodal-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px 16px;
        }
        @media (max-width: 720px) {
          .mmodal-grid { grid-template-columns: 1fr; }
        }
        .mmodal-field { display: block; }
        .mmodal-label { display: block; font-size: 13px; color: #475569; margin-bottom: 6px; font-weight: 600; }
        .req { color: #ef4444; margin-left: 4px; }
        .mmodal-input {
          width: 100%; padding: 10px 12px; border-radius: 8px;
          border: 1px solid #e5e7eb; background: #fff; color: #0f172a;
          transition: border-color .15s ease;
        }
        .mmodal-input:focus { outline: none; border-color: #94a3b8; box-shadow: 0 0 0 3px rgba(148,163,184,.2); }
        .mmodal-inline { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .mmodal-hint { display: block; margin-top: 6px; color: #64748b; }
        .mmodal-footer {
          display: flex; justify-content: flex-end; gap: 8px;
          padding: 12px 16px; border-top: 1px solid #eef2f6; background: #fafbfc;
        }
        .mmodal-btn {
          border: 1px solid #e5e7eb; background: #fff; color: #0f172a;
          padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: 600;
        }
        .mmodal-btn:hover { background: #f8fafc; }
        .mmodal-btn.primary {
          border-color: #2563eb; background: #2563eb; color: #fff;
        }
        .mmodal-btn.primary:hover { background: #1d4ed8; }
      `}</style>
    </div>
  );
}