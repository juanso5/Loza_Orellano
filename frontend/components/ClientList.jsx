// components/ClientList.jsx
import React from 'react';
const ClientList = ({ clients, searchQuery, selectedClientId, onSelectClient }) => {
  const filteredClients = clients.filter((c) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    // Buscar en nombre del cliente
    if (c.name.toLowerCase().includes(query)) return true;
    // Buscar en nombres de carteras (portfolios es array de fondos)
    if (Array.isArray(c.portfolios)) {
      return c.portfolios.some((p) => {
        const carteraNombre = p.carteraNombre || p.tipoCarteraNombre || '';
        return carteraNombre.toLowerCase().includes(query);
      });
    }
    return false;
  });
  const initials = (name = '') => name.split(' ').map((p) => p[0] || '').slice(0, 2).join('').toUpperCase();
  return (
    <div id="clients-list" className="clients-list card-body" aria-live="polite">
      {filteredClients.map((c) => {
        const portfoliosCount = Array.isArray(c.portfolios) ? c.portfolios.length : 0;
        const movementsCount = Array.isArray(c.movements) ? c.movements.length : 0;
        return (
          <div
            key={c.id}
            className={`client-row ${c.id === selectedClientId ? 'active' : ''}`}
            onClick={() => onSelectClient(c.id)}
          >
            <div className="client-avatar">{initials(c.name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="client-name">{c.name}</div>
              <div className="client-meta">Carteras: {portfoliosCount} · Movs: {movementsCount}</div>
            </div>
            <div className="client-chevron"><i className="fas fa-chevron-right"></i></div>
          </div>
        );
      })}
    </div>
  );
};
export default ClientList;