// components/LiquidezModal.jsx
'use client';
import { useState, useEffect } from 'react';
export default function LiquidezModal({ open, onClose, onSave, editingMovement = null }) {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [saldoDisponible, setSaldoDisponible] = useState(null); // Saldo disponible del cliente
  // Datos del formulario
  const [clienteId, setClienteId] = useState('');
  const [fecha, setFecha] = useState('');
  const [tipoMov, setTipoMov] = useState('deposito');
  const [tipoCambio, setTipoCambio] = useState('usd');
  const [monto, setMonto] = useState('');
  const [comentario, setComentario] = useState('');
  const [tipoCambioManual, setTipoCambioManual] = useState(''); // Tipo de cambio manual
  // Inicializar fecha actual
  useEffect(() => {
    if (!fecha) {
      const now = new Date();
      const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
      setFecha(localDate.toISOString().slice(0, 16));
    }
  }, []);
  // Cargar clientes y tipo de cambio - Se recarga cada vez que se abre el modal
  useEffect(() => {
    if (!open) return;
    const fetchData = async () => {
      try {
        // Cargar clientes
        const clientesRes = await fetch('/api/cliente', { cache: 'no-store' });
        const clientesData = await clientesRes.json();
        setClientes(Array.isArray(clientesData?.data) ? clientesData.data : []);
        // Cargar tipo de cambio actual (siempre actualizado)
        const exchangeRes = await fetch('/api/tipo-cambio?latest=true', { cache: 'no-store' });
        const exchangeData = await exchangeRes.json();
        const rateData = exchangeData?.data || null;
        setExchangeRate(rateData);
        // Pre-llenar el tipo de cambio manual si existe
        if (rateData && !tipoCambioManual) {
          setTipoCambioManual(rateData.usd_ars_venta?.toString() || '');
        }
      } catch (error) {
        setClientes([]);
        setExchangeRate(null);
      }
    };
    // Recargar cada vez que se abre el modal
    fetchData();
  }, [open]);
  // Cargar saldo disponible cuando cambia el cliente
  useEffect(() => {
    const loadSaldoCliente = async () => {
      if (!clienteId || !open) {
        setSaldoDisponible(null);
        return;
      }
      try {
        // Cargar todos los movimientos del cliente
        const response = await fetch(`/api/liquidez?cliente_id=${clienteId}&limit=1000`, {
          cache: 'no-store'
        });
        const data = await response.json();
        const movimientos = Array.isArray(data?.data) ? data.data : [];
        // Calcular saldo TOTAL en USD (todo convertido a USD)
        let saldoTotalUSD = 0;
        movimientos.forEach(mov => {
          const montoUSD = parseFloat(mov.monto_usd) || 0;
          const multiplicador = mov.tipo_mov === 'deposito' ? 1 : -1;
          saldoTotalUSD += montoUSD * multiplicador;
        });
        setSaldoDisponible({
          totalUSD: saldoTotalUSD
        });
      } catch (error) {
        setSaldoDisponible(null);
      }
    };
    loadSaldoCliente();
  }, [clienteId, open]);
  // Pre-llenar formulario cuando se edita
  useEffect(() => {
    if (editingMovement) {
      setClienteId(editingMovement.cliente_id?.toString() || '');
      setFecha(editingMovement.fecha ? new Date(editingMovement.fecha).toISOString().slice(0, 16) : '');
      setTipoMov(editingMovement.tipo_mov || 'deposito');
      setTipoCambio(editingMovement.tipo_cambio || 'usd');
      setMonto(editingMovement.monto?.toString() || '');
      setComentario(editingMovement.comentario || '');
      setTipoCambioManual(editingMovement.tipo_cambio_usado?.toString() || '');
    } else {
      // Limpiar formulario para nuevo movimiento
      setClienteId('');
      const now = new Date();
      const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
      setFecha(localDate.toISOString().slice(0, 16));
      setTipoMov('deposito');
      setTipoCambio('usd');
      setMonto('');
      setComentario('');
      // tipoCambioManual se llena desde el useEffect de arriba
    }
  }, [editingMovement, open]);
  const handleSave = async () => {
    if (!clienteId || !fecha || !monto) {
      alert('Por favor completa todos los campos obligatorios');
      return;
    }
    if (!tipoCambioManual || parseFloat(tipoCambioManual) <= 0) {
      alert('Por favor ingresa un tipo de cambio v├ílido');
      return;
    }
    const montoNum = parseFloat(monto);
    const tipoCambioNum = parseFloat(tipoCambioManual);
    // Validar saldo disponible para extracciones
    if (tipoMov === 'extraccion' && saldoDisponible) {
      // Convertir el monto a retirar a USD para comparar
      const montoRetiroUSD = tipoCambio === 'usd' 
        ? montoNum 
        : montoNum / tipoCambioNum;
      if (montoRetiroUSD > saldoDisponible.totalUSD) {
        // Calcular cu├ínto puede retirar en la moneda seleccionada
        const disponibleEnMoneda = tipoCambio === 'usd'
          ? saldoDisponible.totalUSD
          : saldoDisponible.totalUSD * tipoCambioNum;
        const monedaLabel = tipoCambio === 'usd' ? 'USD' : 'ARS';
        alert(`Saldo insuficiente. Disponible: ${disponibleEnMoneda.toLocaleString('es-AR', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })} ${monedaLabel}`);
        return;
      }
    }
    setLoading(true);
    try {
      const payload = {
        cliente_id: parseInt(clienteId),
        fecha: new Date(fecha).toISOString(),
        tipo_mov: tipoMov,
        tipo_cambio: tipoCambio,
        monto: montoNum,
        comentario: comentario.trim() || null,
      };
      // Calcular conversiones basadas en el tipo de cambio manual
      if (tipoCambio === 'usd') {
        // Si ingres├│ USD, guardamos USD y calculamos ARS
        payload.tipo_cambio_usado = tipoCambioNum;
        payload.monto_usd = montoNum;
      } else {
        // Si ingres├│ ARS, calculamos USD
        payload.tipo_cambio_usado = tipoCambioNum;
        payload.monto_usd = montoNum / tipoCambioNum;
      }
      if (editingMovement) {
        payload.id = editingMovement.id_mov_liq || editingMovement.id_liq;
      }
      await onSave?.(payload);
    } catch (error) {
      alert('Error al guardar el movimiento');
    } finally {
      setLoading(false);
    }
  };
  const handleClose = () => {
    if (!loading) {
      onClose?.();
    }
  };
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal-content" style={{ maxWidth: '500px', width: '90%' }}>
        <div className="modal-header">
          <h2>{editingMovement ? 'Editar Movimiento' : 'Nuevo Movimiento de Liquidez'}</h2>
          <button 
            className="btn-close" 
            onClick={handleClose}
            disabled={loading}
            aria-label="Cerrar modal"
          >
            Ô£ò
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="cliente">Cliente *</label>
            <select
              id="cliente"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              disabled={loading}
              required
            >
              <option value="">Seleccionar cliente</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="fecha">Fecha *</label>
            <input
              type="datetime-local"
              id="fecha"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="tipoMov">Tipo de Movimiento *</label>
              <select
                id="tipoMov"
                value={tipoMov}
                onChange={(e) => setTipoMov(e.target.value)}
                disabled={loading}
                required
              >
                <option value="deposito">Dep├│sito</option>
                <option value="extraccion">Extracci├│n</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="tipoCambio">Moneda *</label>
              <select
                id="tipoCambio"
                value={tipoCambio}
                onChange={(e) => setTipoCambio(e.target.value)}
                disabled={loading}
                required
              >
                <option value="usd">USD</option>
                <option value="ars">ARS</option>
              </select>
            </div>
          </div>
          {/* Mostrar saldo disponible solo para extracciones */}
          {tipoMov === 'extraccion' && clienteId && saldoDisponible && tipoCambioManual && parseFloat(tipoCambioManual) > 0 && (
            <div style={{
              marginBottom: '16px',
              padding: '14px',
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              border: '2px solid #fbbf24',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(251, 191, 36, 0.1)'
            }}>
              <div style={{ 
                fontSize: '0.85em', 
                fontWeight: '600', 
                color: '#92400e',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <i className="fas fa-wallet"></i>
                Saldo Disponible para Retiro:
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '12px' 
              }}>
                {/* USD - Saldo base */}
                <div style={{ 
                  padding: '10px', 
                  background: 'white',
                  borderRadius: '6px',
                  border: tipoCambio === 'usd' ? '2px solid #3b82f6' : '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '0.75em', color: '#6b7280', marginBottom: '4px' }}>
                    USD
                  </div>
                  <div style={{ 
                    fontSize: '1.1em', 
                    fontWeight: '700',
                    color: saldoDisponible.totalUSD >= 0 ? '#059669' : '#dc2626'
                  }}>
                    ${saldoDisponible.totalUSD.toLocaleString('es-AR', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </div>
                </div>
                {/* ARS - Convertido seg├║n tipo de cambio */}
                <div style={{ 
                  padding: '10px', 
                  background: 'white',
                  borderRadius: '6px',
                  border: tipoCambio === 'ars' ? '2px solid #3b82f6' : '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '0.75em', color: '#6b7280', marginBottom: '4px' }}>
                    ARS (al tipo {parseFloat(tipoCambioManual).toFixed(2)})
                  </div>
                  <div style={{ 
                    fontSize: '1.1em', 
                    fontWeight: '700',
                    color: saldoDisponible.totalUSD >= 0 ? '#059669' : '#dc2626'
                  }}>
                    ${(saldoDisponible.totalUSD * parseFloat(tipoCambioManual)).toLocaleString('es-AR', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </div>
                </div>
              </div>
              {/* Advertencia si no hay saldo */}
              {saldoDisponible.totalUSD <= 0 && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px',
                  background: '#fee2e2',
                  borderRadius: '4px',
                  fontSize: '0.8em',
                  color: '#991b1b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <i className="fas fa-exclamation-triangle"></i>
                  No hay saldo disponible para retirar
                </div>
              )}
              {/* Nota explicativa */}
              <div style={{
                marginTop: '8px',
                fontSize: '0.75em',
                color: '#78716c',
                fontStyle: 'italic',
                textAlign: 'center'
              }}>
                ­ƒÆí Es el mismo saldo, mostrado en ambas monedas seg├║n el tipo de cambio
              </div>
            </div>
          )}
          <div className="form-group">
            <label htmlFor="tipoCambioManual">
              Tipo de Cambio USD/ARS *
              {exchangeRate && (
                <span className="exchange-info" style={{ fontSize: '0.85em', color: '#666' }}>
                  {' '}(Actual: {exchangeRate.usd_ars_venta})
                </span>
              )}
            </label>
            <input
              type="number"
              id="tipoCambioManual"
              value={tipoCambioManual}
              onChange={(e) => setTipoCambioManual(e.target.value)}
              placeholder="Ej: 1050.00"
              min="0"
              step="0.01"
              disabled={loading}
              required
            />
            <small style={{ color: '#666', fontSize: '0.85em' }}>
              Ingresa el tipo de cambio a utilizar para esta operaci├│n
            </small>
          </div>
          <div className="form-group">
            <label htmlFor="monto">
              Monto en {tipoCambio === 'usd' ? 'USD' : 'ARS'} *
            </label>
            <input
              type="number"
              id="monto"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              disabled={loading}
              required
            />
            {/* Conversi├│n autom├ítica */}
            {tipoCambioManual && monto && parseFloat(tipoCambioManual) > 0 && parseFloat(monto) > 0 && (
              <div className="conversion-display" style={{
                marginTop: '10px',
                padding: '12px',
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '6px',
                fontSize: '0.95em'
              }}>
                {tipoCambio === 'usd' ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '500' }}>Equivalente en ARS:</span>
                    <span style={{ fontSize: '1.1em', fontWeight: '600', color: '#0369a1' }}>
                      $ {(parseFloat(monto) * parseFloat(tipoCambioManual)).toLocaleString('es-AR', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '500' }}>Equivalente en USD:</span>
                    <span style={{ fontSize: '1.1em', fontWeight: '600', color: '#0369a1' }}>
                      USD {(parseFloat(monto) / parseFloat(tipoCambioManual)).toLocaleString('es-AR', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="comentario">Comentario</label>
            <textarea
              id="comentario"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Comentario opcional..."
              rows="3"
              disabled={loading}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button 
            className="btn" 
            onClick={handleClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button 
            className="btn primary" 
            onClick={handleSave}
            disabled={loading || !clienteId || !fecha || !monto}
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 24px 0;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 24px;
        }
        .modal-header h2 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
          color: #111827;
        }
        .btn-close {
          background: transparent;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #6b7280;
          padding: 4px;
        }
        .btn-close:hover {
          color: #374151;
        }
        .modal-body {
          padding: 0 24px;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          color: #374151;
        }
        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
        }
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        .form-group textarea {
          resize: vertical;
          min-height: 80px;
        }
        .modal-footer {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding: 24px;
          border-top: 1px solid #e5e7eb;
          margin-top: 24px;
        }
        .btn {
          padding: 10px 20px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
          background: white;
          color: #374151;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn:hover {
          background: #f9fafb;
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn.primary {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }
        .btn.primary:hover:not(:disabled) {
          background: #1d4ed8;
        }
        .exchange-info {
          font-size: 12px;
          color: #6b7280;
          font-weight: normal;
          margin-left: 8px;
        }
        .exchange-info .rate {
          color: #059669;
          font-weight: 500;
        }
        .conversion-info {
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
