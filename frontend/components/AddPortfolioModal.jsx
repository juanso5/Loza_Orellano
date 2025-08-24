// components/AddPortfolioModal.jsx
import React, { useState, useEffect } from 'react';

const AddPortfolioModal = ({ onClose, onSave, uid }) => {
  const [name, setName] = useState('');
  const [period, setPeriod] = useState('12');

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

  const periodNum = Number.isFinite(parseInt(period, 10)) ? parseInt(period, 10) : NaN;
  const isSaveDisabled = !name.trim() || !Number.isFinite(periodNum) || periodNum < 1;

  const handleSave = () => {
    const p = Number.isFinite(periodNum) && periodNum > 0 ? periodNum : 12;
    if (!name.trim()) return;
    onSave({
      id: uid('p'),
      name: name.trim(),
      periodMonths: p,
      progress: 0,
      funds: [],
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isSaveDisabled) handleSave();
  };

  // Cerrar al hacer click fuera del modal (overlay)
  const handleOverlayMouseDown = (e) => {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  };

  return (
    <div
      className="modal"
      style={{ display: 'flex' }}
      aria-hidden="false"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-portfolio-title"
      onMouseDown={handleOverlayMouseDown}
    >
      <div className="modal-dialog">
        <form onSubmit={handleSubmit}>
          <header className="modal-header">
            <h2 id="add-portfolio-title">Agregar nueva cartera</h2>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">&times;</button>
          </header>
          <div className="modal-body">
            <div className="input-group">
              <label htmlFor="add-portfolio-name">Nombre de la cartera</label>
              <input
                id="add-portfolio-name"
                placeholder="p.e. Fondo Retiro"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label htmlFor="add-portfolio-period">Periodo objetivo (meses)</label>
              <input
                id="add-portfolio-period"
                type="number"
                min="1"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </div>
            <div className="hint muted">La nueva cartera se agrega al cliente seleccionado.</div>
          </div>
          <footer className="modal-footer">
            <button type="submit" className="btn-save" disabled={isSaveDisabled} aria-disabled={isSaveDisabled}>
              <i className="fas fa-check"></i> Guardar
            </button>
            <button type="button" className="btn-close" onClick={onClose}>
              <i className="fas fa-times"></i> Cancelar
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default AddPortfolioModal;