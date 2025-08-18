// components/AddPortfolioModal.jsx
import React, { useState } from 'react';

const AddPortfolioModal = ({ onClose, onSave, uid }) => {
  const [name, setName] = useState('');
  const [period, setPeriod] = useState('12');

  const handleSave = () => {
    const periodNum = parseInt(period, 10) || 12;
    if (!name.trim()) return;
    onSave({
      id: uid('p'),
      name: name.trim(),
      periodMonths: periodNum,
      progress: 0,
      funds: [],
    });
  };

  return (
    <div className="modal" style={{ display: 'flex' }} aria-hidden="false">
      <div className="modal-dialog">
        <header className="modal-header">
          <h2>Agregar nueva cartera</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">&times;</button>
        </header>
        <div className="modal-body">
          <div className="input-group">
            <label htmlFor="add-portfolio-name">Nombre de la cartera</label>
            <input id="add-portfolio-name" placeholder="p.e. Fondo Retiro" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="input-group">
            <label htmlFor="add-portfolio-period">Periodo objetivo (meses)</label>
            <input id="add-portfolio-period" type="number" min="1" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div className="hint muted">La nueva cartera se agrega al cliente seleccionado.</div>
        </div>
        <footer className="modal-footer">
          <button className="btn-save" onClick={handleSave}>Crear cartera</button>
          <button className="btn-close" onClick={onClose}>Cancelar</button>
        </footer>
      </div>
    </div>
  );
};

export default AddPortfolioModal;