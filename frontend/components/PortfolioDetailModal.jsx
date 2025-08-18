import React, { useState, useEffect } from 'react';

const PortfolioDetailModal = ({ clients, context, onClose, onSave, onOpenSpeciesHistory }) => {
  const [fundFilter, setFundFilter] = useState('');
  const [editedFunds, setEditedFunds] = useState([]);

  const client = clients.find((c) => c.id === context.clientId);
  const portfolio = client?.portfolios.find((p) => p.id === context.portfolioId);

  useEffect(() => {
    if (portfolio) {
      setEditedFunds(portfolio.funds.map((f) => ({ ...f })));
    }
  }, [portfolio]);

  const filteredFunds = editedFunds.filter((f) => !fundFilter || f.name.toLowerCase().includes(fundFilter.toLowerCase()));
  const total = editedFunds.reduce((s, f) => s + (f.nominal || 0), 0);

  const handleNominalChange = (fundId, value) => {
    const val = parseFloat(value.replace(/\s/g, '').replace(/,/g, ''));
    if (isNaN(val)) return;
    setEditedFunds((prev) => prev.map((f) => (f.id === fundId ? { ...f, nominal: val } : f)));
  };

  const handleSave = () => {
    const updatedPortfolio = { ...portfolio, funds: editedFunds.filter((f) => f.nominal > 0) };
    onSave(updatedPortfolio);
  };

  return (
    <div className="modal" style={{ display: 'flex' }} aria-hidden="false">
      <div className="modal-dialog">
        <header className="modal-header">
          <h2>Detalle de cartera <span style={{ fontWeight: 600 }}>{`${client?.name} — ${portfolio?.name}`}</span></h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">&times;</button>
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
                          value={f.nominal.toFixed(2)}
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
          <button className="btn-save" onClick={handleSave}>Guardar cambios</button>
          <button className="btn-close" onClick={onClose}>Cerrar</button>
        </footer>
      </div>
    </div>
  );
};

export default PortfolioDetailModal;