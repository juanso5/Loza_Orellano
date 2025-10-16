// components/SpeciesHistoryModal.jsx
import React from 'react';
const SpeciesHistoryModal = ({ clients, context, onClose }) => {
  const client = clients.find((c) => c.id === context.clientId);
  const portfolio = client?.portfolios.find((p) => p.id === context.portfolioId);
  const rows = client?.movements
    .filter((m) => m.portfolio === portfolio?.name && m.fund.toLowerCase() === context.fundName.toLowerCase())
    .sort((a, b) => new Date(b.date) - new Date(a.date)) || [];
  const fmtDate = (s) => {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d)) return s;
    return d.toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: 'numeric' });
  };
  const formatNumber = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  return (
    <div className="modal" style={{ display: 'flex' }} aria-hidden="false">
      <div className="modal-dialog">
        <header className="modal-header">
          <h2>Historial de la especie <span style={{ fontWeight: 600 }}>{`${context.fundName} — ${portfolio?.name}`}</span></h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">&times;</button>
        </header>
        <div className="modal-body">
          <table className="movements-table" style={{ width: '100%' }}>
            <thead>
              <tr><th>Fecha</th><th>Tipo</th><th>Cartera</th><th className="right">Monto (unidades)</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="4" className="muted">No hay movimientos para esta especie en la cartera.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.date)}</td>
                    <td>{r.type}</td>
                    <td>{r.portfolio}</td>
                    <td className="right">{formatNumber(r.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <footer className="modal-footer">
          <button className="btn-close" onClick={onClose}>Cerrar</button>
        </footer>
      </div>
    </div>
  );
};
export default SpeciesHistoryModal;