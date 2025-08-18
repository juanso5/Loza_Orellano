// components/MovementModal.jsx
import React, { useState, useEffect } from 'react';

const MovementModal = ({ clients, selectedClientId, onClose, onSave, uid }) => {
  const [clientId, setClientId] = useState(selectedClientId || '');
  const [type, setType] = useState('compra');
  const [carteraId, setCarteraId] = useState('');
  const [fondoSelect, setFondoSelect] = useState('');
  const [fondoNew, setFondoNew] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [available, setAvailable] = useState('');
  const [error, setError] = useState('');
  const [disabled, setDisabled] = useState(false);

  const selectedClient = clients.find((c) => c.id === clientId);
  const selectedPortfolio = selectedClient?.portfolios.find((p) => p.id === carteraId);

  useEffect(() => {
    if (clientId) {
      setCarteraId(selectedClient?.portfolios[0]?.id || '');
    }
  }, [clientId, selectedClient]);

  useEffect(() => {
    updateAvailable();
  }, [clientId, carteraId, fondoSelect, type, monto]);

  const getAvailableUnits = () => {
    if (!selectedPortfolio || !fondoSelect || fondoSelect === '__new__') return 0;
    const f = selectedPortfolio.funds.find((x) => x.name === fondoSelect);
    return f ? f.nominal || 0 : 0;
  };

  const updateAvailable = () => {
    setError('');
    setDisabled(false);
    if (!clientId || !carteraId || !fondoSelect) return;

    if (fondoSelect === '__new__') {
      if (type === 'venta') {
        setAvailable('No es posible vender: la especie no existe en esta cartera.');
        setError('Venta no permitida: seleccioná una especie existente o cambiá a Compra.');
        setDisabled(true);
      } else {
        setAvailable('Vas a crear una nueva especie en la cartera al guardar (compra).');
      }
    } else {
      const avail = getAvailableUnits();
      if (type === 'venta') {
        setAvailable(`Disponibles: ${avail.toLocaleString('es-AR', { maximumFractionDigits: 2 })} unidades.`);
        const cur = parseFloat(monto || '0');
        if (cur > avail) {
          setError(`No podés vender más de ${avail.toLocaleString('es-AR', { maximumFractionDigits: 2 })} unidades.`);
          setDisabled(true);
        }
      } else {
        setAvailable(`Existentes: ${avail.toLocaleString('es-AR', { maximumFractionDigits: 2 })} u. — seleccionar para comprar o agregar nueva especie.`);
      }
    }
  };

  const handleSave = () => {
    let fondo = fondoSelect === '__new__' ? fondoNew.trim() : fondoSelect;
    const amount = parseFloat(monto);
    if (!selectedPortfolio || !fondo || !fecha || isNaN(amount) || amount <= 0) {
      setError('Completá todos los campos correctamente (monto > 0).');
      return;
    }
    if (type === 'venta') {
      const avail = getAvailableUnits();
      if (amount > avail) {
        setError(`No podés retirar más de lo que hay. Disponibles: ${avail.toLocaleString('es-AR', { maximumFractionDigits: 2 })} unidades.`);
        return;
      }
    }

    const movement = { id: uid('m'), date: fecha, type, fund: fondo, portfolio: selectedPortfolio.name, amount };
    const updatedPortfolios = selectedClient.portfolios.map((p) => {
      if (p.id !== carteraId) return p;
      let funds = [...p.funds];
      let fundObj = funds.find((f) => f.name.toLowerCase() === fondo.toLowerCase());
      if (!fundObj) {
        fundObj = { id: uid('f'), name: fondo, nominal: 0, monthlyReturn: 0, totalReturn: 0 };
        funds.push(fundObj);
      }
      fundObj.nominal += type === 'compra' ? amount : -amount;
      funds = funds.filter((f) => f.nominal > 0);
      return { ...p, funds };
    });

    onSave({ clientId, movement, updatedPortfolios });
  };

  return (
    <div className="modal" style={{ display: 'flex' }} aria-hidden="false" role="dialog" aria-modal="true" aria-labelledby="move-modal-title">
      <div className="modal-dialog">
        <header className="modal-header">
          <h2 id="move-modal-title"><i className="fas fa-exchange-alt"></i> Nuevo movimiento</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">&times;</button>
        </header>
        <div className="modal-body">
          <div className="input-group">
            <label htmlFor="mov-client"><i className="fas fa-user"></i> Cliente</label>
            <select id="mov-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
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
              <select id="mov-cartera" value={carteraId} onChange={(e) => setCarteraId(e.target.value)}>
                {selectedClient?.portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="mov-fondo-select"><i className="fas fa-seedling"></i> Especie</label>
            <select id="mov-fondo-select" value={fondoSelect} onChange={(e) => setFondoSelect(e.target.value)}>
              {selectedPortfolio?.funds.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name} — {f.nominal.toLocaleString('es-AR', { maximumFractionDigits: 2 })} u.
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
                {available}
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
          <button className="btn-save" onClick={handleSave} disabled={disabled}>
            <i className="fas fa-save"></i> Guardar
          </button>
          <button className="btn-close" onClick={onClose}>Cancelar</button>
        </footer>
      </div>
    </div>
  );
};

export default MovementModal;