// components/MovementModal.jsx (mismo estilo anterior, datos desde la base)
"use client";
import React, { useEffect, useMemo, useState } from 'react';

const MovementModal = ({ selectedClientId, onClose, onSaved }) => {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState(selectedClientId || '');
  const [type, setType] = useState('compra');
  const [carteraId, setCarteraId] = useState('');
  const [fondoSelect, setFondoSelect] = useState('');      // especie seleccionada (id) o '__new__'
  const [fondoNew, setFondoNew] = useState('');            // nombre nueva especie
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [availableMsg, setAvailableMsg] = useState('');
  const [error, setError] = useState('');
  const [disabled, setDisabled] = useState(false);

  const [portfolios, setPortfolios] = useState([]);        // [{id,name}]
  const [funds, setFunds] = useState([]);                  // [{id,name,nominal}] saldo por especie en cartera

  // Cerrar con Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Normaliza números con coma o punto
  const parseAmount = (val) => {
    if (val === null || val === undefined) return NaN;
    return parseFloat(String(val).replace(',', '.'));
  };

  // Cargar clientes para el select
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/cliente', { cache: 'no-store' });
        const j = await r.json();
        const list = Array.isArray(j?.data) ? j.data : [];
        const mapped = list
          .map((c) => ({ id: Number(c.id ?? c.id_cliente ?? 0), name: c.name ?? c.nombre ?? '' }))
          .filter((c) => c.id && c.name);
        setClients(mapped);
        if (!clientId && mapped[0]) setClientId(mapped[0].id);
      } catch (e) {
        console.error('MovementModal clientes error:', e);
      }
    })();
  }, []);

  // Cargar carteras del cliente
  useEffect(() => {
    setPortfolios([]);
    setCarteraId('');
    setFunds([]);
    setFondoSelect('');
    if (!clientId) return;
    (async () => {
      try {
        const r = await fetch(`/api/fondo?cliente_id=${clientId}`, { cache: 'no-store' });
        const j = await r.json();
        const rows = Array.isArray(j?.data) ? j.data : [];
        const mapped = rows
          .map((f) => ({
            id: Number(f.id ?? f.id_fondo ?? 0),
            name:
              f?.nombre ??
              f?.name ??
              f?.descripcion ??
              f?.tipo_cartera?.descripcion ??
              `Cartera ${Number(f.id ?? f.id_fondo ?? 0)}`,
          }))
          .filter((p) => p.id);
        setPortfolios(mapped);
        if (mapped[0]) setCarteraId(mapped[0].id);
      } catch (e) {
        console.error('MovementModal fondos error:', e);
      }
    })();
  }, [clientId]);

  // Cargar saldo por especie en la cartera
  const loadFunds = async (clienteId, fondoId) => {
    setFunds([]);
    setFondoSelect('');
    if (!clienteId || !fondoId) return;
    try {
      const r = await fetch(`/api/movimiento?cliente_id=${clienteId}&fondo_id=${fondoId}&limit=10000`, { cache: 'no-store' });
      const j = await r.json();
      const data = Array.isArray(j?.data) ? j.data : [];
      const byId = new Map();
      for (const m of data) {
        const idE = Number(m.tipo_especie_id);
        const nameE = m.especie || '';
        const n = Number(m.nominal) || 0;
        if (!idE || !nameE) continue;
        const prev = byId.get(idE) || { id: idE, name: nameE, nominal: 0 };
        prev.nominal += m.tipo_mov === 'venta' ? -n : n;
        byId.set(idE, prev);
      }
      const list = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
      setFunds(list);
      if (list[0]) setFondoSelect(String(list[0].id));
    } catch (e) {
      console.error('MovementModal especies/saldo error:', e);
    }
  };

  useEffect(() => {
    if (clientId && carteraId) loadFunds(clientId, carteraId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carteraId, clientId, fecha, type]);

  const selectedFund = useMemo(
    () => funds.find((f) => String(f.id) === String(fondoSelect)),
    [funds, fondoSelect]
  );

  // Actualiza mensajes de disponible
  useEffect(() => {
    setError('');
    setDisabled(false);
    if (!clientId || !carteraId) return;

    if (fondoSelect === '__new__') {
      if (type === 'venta') {
        setAvailableMsg('No es posible vender: la especie no existe en esta cartera.');
        setError('Venta no permitida: seleccioná una especie existente o cambiá a Compra.');
        setDisabled(true);
      } else {
        setAvailableMsg('Vas a crear una nueva especie en la cartera al guardar (compra).');
      }
      return;
    }

    const avail = selectedFund?.nominal || 0;
    if (type === 'venta') {
      setAvailableMsg(`Disponibles: ${avail.toLocaleString('es-AR', { maximumFractionDigits: 2 })} unidades.`);
      const cur = parseAmount(monto || '0');
      if (cur > avail) {
        setError(`No podés vender más de ${avail.toLocaleString('es-AR', { maximumFractionDigits: 2 })} unidades.`);
        setDisabled(true);
      }
    } else {
      setAvailableMsg(
        `Existentes: ${avail.toLocaleString('es-AR', { maximumFractionDigits: 2 })} u. — seleccionar para comprar o agregar nueva especie.`
      );
    }
  }, [clientId, carteraId, fondoSelect, selectedFund, type, monto]);

  const handleSave = async () => {
    let especieNombre = fondoSelect === '__new__' ? (fondoNew || '').trim() : selectedFund?.name;
    const especieId = fondoSelect !== '__new__' ? Number(fondoSelect) : null;
    const amount = parseAmount(monto);

    if (!clientId || !carteraId || !fecha || !type) {
      setError('Completá todos los campos.');
      return;
    }
    if (fondoSelect === '__new__' && !especieNombre) {
      setError('Ingresá el nombre de la nueva especie.');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setError('El monto debe ser mayor a 0.');
      return;
    }
    if (type === 'venta') {
      const avail = selectedFund?.nominal || 0;
      if (amount > avail) {
        setError(`No podés retirar más de lo que hay. Disponibles: ${avail.toLocaleString('es-AR', { maximumFractionDigits: 2 })} unidades.`);
        return;
      }
    }

    try {
      const payload = {
        cliente_id: Number(clientId),
        fondo_id: Number(carteraId),
        fecha_alta: fecha,
        tipo_mov: type,
        nominal: amount,
        ...(especieId ? { tipo_especie_id: especieId } : { especie: especieNombre }),
      };
      const res = await fetch('/api/movimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error || 'No se pudo guardar el movimiento');
        return;
      }
      onSaved?.();
    } catch (e) {
      console.error('Guardar movimiento error:', e);
      setError('Error inesperado al guardar');
    }
  };

  const isSaveDisabled =
    disabled ||
    !clientId ||
    !carteraId ||
    !fecha ||
    !type ||
    !((fondoSelect && fondoSelect !== '__new__') || (fondoSelect === '__new__' && fondoNew.trim())) ||
    isNaN(parseAmount(monto)) ||
    parseAmount(monto) <= 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isSaveDisabled) handleSave();
  };

  const handleOverlayMouseDown = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <div
      className="modal"
      style={{ display: 'flex' }}
      aria-hidden="false"
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-modal-title"
      onMouseDown={handleOverlayMouseDown}
    >
      <div className="modal-dialog">
        <form onSubmit={handleSubmit}>
          <header className="modal-header">
            <h2 id="move-modal-title"><i className="fas fa-exchange-alt"></i> Nuevo movimiento</h2>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">&times;</button>
          </header>

          <div className="modal-body">
            <div className="input-group">
              <label htmlFor="mov-client"><i className="fas fa-user"></i> Cliente</label>
              <select id="mov-client" value={clientId} onChange={(e) => setClientId(Number(e.target.value))}>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="grid-2">
              <div className="input-group">
                <label htmlFor="mov-type"><i className="fas fa-tag"></i> Tipo</label>
                <select id="mov-type" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="compra">Compra</option>
                  <option value="venta">Venta</option>
                </select>
              </div>

              <div className="input-group">
                <label htmlFor="mov-cartera"><i className="fas fa-wallet"></i> Cartera</label>
                <select id="mov-cartera" value={carteraId} onChange={(e) => setCarteraId(Number(e.target.value))}>
                  {portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="mov-fondo-select"><i className="fas fa-line-chart"></i> Especie</label>
              <select id="mov-fondo-select" value={fondoSelect} onChange={(e) => setFondoSelect(e.target.value)}>
                {funds.map((f) => (
                  <option key={f.id} value={String(f.id)}>
                    {f.name} — {Number(f.nominal || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })} u.
                  </option>
                ))}
                <option value="__new__">➕ Agregar nueva especie...</option>
              </select>
              {fondoSelect === '__new__' && (
                <input
                  id="mov-fondo-new"
                  type="text"
                  placeholder="Nueva especie (p.e. YPF)..."
                  value={fondoNew}
                  onChange={(e) => setFondoNew(e.target.value)}
                  style={{ marginTop: '8px' }}
                />
              )}
            </div>

            <div className="grid-2">
              <div className="input-group">
                <label htmlFor="mov-monto"><i className="fas fa-dollar-sign"></i> Monto (unidades)</label>
                <input
                  id="mov-monto"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  min="0"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                />
                <div className="field-hint" id="mov-available" aria-live="polite" style={{ marginTop: '6px' }}>
                  {availableMsg}
                </div>
                {error && (
                  <div className="field-error" style={{ display: 'block' }}>
                    {error}
                  </div>
                )}
              </div>
              <div className="input-group">
                <label htmlFor="mov-fecha"><i className="fas fa-calendar-day"></i> Fecha</label>
                <input id="mov-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
            </div>
            <div className="hint muted">
              <i className="fas fa-info-circle"></i> Al guardar la compra/venta se ajustará el nominal de la especie en la cartera seleccionada.
            </div>
          </div>

          <footer className="modal-footer">
            <button type="submit" className="btn-save" disabled={isSaveDisabled} aria-disabled={isSaveDisabled}>
              <i className="fas fa-check"></i> Guardar
            </button>
            <button type="button" className="btn-close" onClick={onClose}><i className="fas fa-times"></i> Cancelar</button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default MovementModal;