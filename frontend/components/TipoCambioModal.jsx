// components/TipoCambioModal.jsx
'use client';
import { useState, useEffect } from 'react';
export default function TipoCambioModal({ open, onClose, onSave, editingRate = null }) {
  const [loading, setLoading] = useState(false);
  // Datos del formulario
  const [fecha, setFecha] = useState('');
  const [usdArsCompra, setUsdArsCompra] = useState('');
  const [usdArsVenta, setUsdArsVenta] = useState('');
  // Inicializar fecha actual
  useEffect(() => {
    if (!fecha && !editingRate) {
      const now = new Date();
      const localDate = now.toISOString().slice(0, 10);
      setFecha(localDate);
    }
  }, [fecha, editingRate]);
  // Pre-llenar formulario cuando se edita
  useEffect(() => {
    if (editingRate) {
      setFecha(editingRate.fecha ? new Date(editingRate.fecha).toISOString().slice(0, 10) : '');
      setUsdArsCompra(editingRate.usd_ars_compra?.toString() || '');
      setUsdArsVenta(editingRate.usd_ars_venta?.toString() || '');
    } else {
      // Limpiar formulario para nuevo tipo de cambio
      const now = new Date();
      const localDate = now.toISOString().slice(0, 10);
      setFecha(localDate);
      setUsdArsCompra('');
      setUsdArsVenta('');
    }
  }, [editingRate, open]);
  const handleSave = async () => {
    if (!fecha || !usdArsCompra || !usdArsVenta) {
      alert('Por favor completa todos los campos');
      return;
    }
    if (parseFloat(usdArsCompra) <= 0 || parseFloat(usdArsVenta) <= 0) {
      alert('Los tipos de cambio deben ser mayores a 0');
      return;
    }
    if (parseFloat(usdArsCompra) > parseFloat(usdArsVenta)) {
      alert('El tipo de cambio de compra no puede ser mayor al de venta');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        fecha,
        usd_ars_compra: parseFloat(usdArsCompra),
        usd_ars_venta: parseFloat(usdArsVenta),
      };
      if (editingRate) {
        payload.id = editingRate.id_tipo_cambio;
      }
      await onSave?.(payload);
    } catch (error) {
      alert('Error al guardar el tipo de cambio');
    } finally {
      setLoading(false);
    }
  };
  const handleClose = () => {
    if (!loading) {
      onClose?.();
    }
  };
  // Calcular spread
  const spread = usdArsCompra && usdArsVenta ? 
    ((parseFloat(usdArsVenta) - parseFloat(usdArsCompra)) / parseFloat(usdArsCompra) * 100).toFixed(2) 
    : null;
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal-content" style={{ maxWidth: '500px', width: '90%' }}>
        <div className="modal-header">
          <h2>{editingRate ? 'Editar Tipo de Cambio' : 'Nuevo Tipo de Cambio'}</h2>
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
            <label htmlFor="fecha">Fecha *</label>
            <input
              type="date"
              id="fecha"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="compra">USD/ARS Compra *</label>
              <input
                type="number"
                id="compra"
                value={usdArsCompra}
                onChange={(e) => setUsdArsCompra(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                disabled={loading}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="venta">USD/ARS Venta *</label>
              <input
                type="number"
                id="venta"
                value={usdArsVenta}
                onChange={(e) => setUsdArsVenta(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                disabled={loading}
                required
              />
            </div>
          </div>
          {spread && (
            <div className="spread-info">
              <div className="spread-label">Spread:</div>
              <div className={`spread-value ${parseFloat(spread) > 5 ? 'high' : 'normal'}`}>
                {spread}%
              </div>
            </div>
          )}
          <div className="info-box">
            <div className="info-item">
              <strong>­ƒÆí Consejos:</strong>
            </div>
            <div className="info-item">
              ÔÇó El tipo de compra siempre debe ser menor al de venta
            </div>
            <div className="info-item">
              ÔÇó Un spread t├¡pico est├í entre 1-3%
            </div>
            <div className="info-item">
              ÔÇó Este tipo de cambio se usar├í para conversiones autom├íticas
            </div>
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
            disabled={loading || !fecha || !usdArsCompra || !usdArsVenta}
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
        .form-group input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
        }
        .form-group input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        .spread-info {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #f3f4f6;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .spread-label {
          font-weight: 500;
          color: #374151;
        }
        .spread-value {
          font-weight: 600;
          font-size: 16px;
        }
        .spread-value.normal {
          color: #059669;
        }
        .spread-value.high {
          color: #d97706;
        }
        .info-box {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }
        .info-item {
          font-size: 14px;
          color: #1e40af;
          margin-bottom: 6px;
        }
        .info-item:last-child {
          margin-bottom: 0;
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
      `}</style>
    </div>
  );
}
