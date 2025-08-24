import React, { useState, useEffect } from 'react';

const PortfolioDetailModal = ({ clients, context, onClose, onSave, onOpenSpeciesHistory }) => {
  const [fundFilter, setFundFilter] = useState('');
  const [editedFunds, setEditedFunds] = useState([]);

  const client = clients.find((c) => c.id === context.clientId);
  const portfolio = client?.portfolios.find((p) => p.id === context.portfolioId);

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

  useEffect(() => {
    if (portfolio) {
      setEditedFunds(portfolio.funds.map((f) => ({ ...f })));
    }
  }, [portfolio]);

  const filteredFunds = editedFunds.filter(
    (f) => !fundFilter || f.name.toLowerCase().includes(fundFilter.toLowerCase())
  );
  const total = editedFunds.reduce((s, f) => s + (Number(f.nominal) || 0), 0);

  const handleNominalChange = (fundId, value) => {
    const val = parseFloat(value.replace(/\s/g, '').replace(/,/g, ''));
    if (isNaN(val)) return;
    setEditedFunds((prev) => prev.map((f) => (f.id === fundId ? { ...f, nominal: val } : f)));
  };

  const handleSave = () => {
    const cleaned = editedFunds
      .map((f) => ({ ...f, nominal: Number(f.nominal) || 0 }))
      .filter((f) => f.nominal > 0);
    const updatedPortfolio = { ...portfolio, funds: cleaned };
    onSave(updatedPortfolio);
  };

  const hasInvalid = !client || !portfolio || editedFunds.some((f) => !Number.isFinite(Number(f.nominal)) || Number(f.nominal) < 0);
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!hasInvalid) handleSave();
  };

  // Cerrar al hacer click fuera del modal (overlay)
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
      aria-labelledby="portfolio-detail-title"
      onMouseDown={handleOverlayMouseDown}
    >
      <div className="modal-dialog">
        <form onSubmit={handleSubmit}>
          <header className="modal-header">
            <h2 id="portfolio-detail-title">
              Detalle de cartera <span style={{ fontWeight: 600 }}>{`${client?.name} — ${portfolio?.name}`}</span>
            </h2>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
              &times;
            </button>
          </header>

          <div className="modal-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <div>
                <label htmlFor="portfolio-fund-filter">Filtrar especie</label>
                <input
                  id="portfolio-fund-filter"
                  placeholder="Filtrar dentro de la cartera..."
                  value={fundFilter}
                  onChange={(e) => setFundFilter(e.target.value)}
                />
              </div>
              <div className="muted" style={{ whiteSpace: 'nowrap' }}>
                Total nominal: {total.toLocaleString('es-AR', { maximumFractionDigits: 2 })} unidades
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <table className="movements-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Especie</th>
                    <th>Nominal (unidades)</th>
                    <th>Rend. mensual</th>
                    <th>Rend. total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFunds.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="muted">No hay especies en esta cartera.</td>
                    </tr>
                  ) : (
                    filteredFunds.map((f) => (
                      <tr key={f.id}>
                        <td
                          className="fund-name-link"
                          style={{ cursor: 'pointer', color: '#0f1720', fontWeight: 600 }}
                          onClick={() => onOpenSpeciesHistory(f.name)}
                        >
                          {f.name}
                        </td>
                        <td>
                          <input
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e6edf3' }}
                            value={(Number(f.nominal) || 0).toFixed(2)}
                            onChange={(e) => handleNominalChange(f.id, e.target.value)}
                          />
                        </td>
                        <td>{((f.monthlyReturn || 0) * 100).toFixed(2)}%</td>
                        <td>{((f.totalReturn || 0) * 100).toFixed(2)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <footer className="modal-footer">
            <button type="submit" className="btn-save" disabled={hasInvalid} aria-disabled={hasInvalid}>
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

export default PortfolioDetailModal;